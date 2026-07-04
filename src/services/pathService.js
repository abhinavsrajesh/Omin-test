import { collection, addDoc, getDocs, serverTimestamp, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

const PATHS_COLLECTION = "ar_paths";

/**
 * Saves a new AR path to Firestore
 * @param {string} name - Name of the path
 * @param {Array} coordinates - Array of coordinates [{x, y, z}, ...] or similar
 * @returns {Promise<string>} - The ID of the newly created document
 */
export async function savePath(name, coordinates) {
  try {
    const docRef = await addDoc(collection(db, PATHS_COLLECTION), {
      name,
      coordinates,
      createdAt: serverTimestamp(),
    });
    console.log("Path saved with ID: ", docRef.id);
    return docRef.id;
  } catch (e) {
    console.error("Error adding path: ", e);
    throw e;
  }
}

/**
 * Retrieves all saved AR paths from Firestore
 * @returns {Promise<Array>} - Array of path objects
 */
export async function getPaths() {
  try {
    const pathsQuery = query(collection(db, PATHS_COLLECTION), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(pathsQuery);
    
    const paths = [];
    querySnapshot.forEach((doc) => {
      paths.push({ id: doc.id, ...doc.data() });
    });
    
    return paths;
  } catch (e) {
    console.error("Error getting paths: ", e);
    throw e;
  }
}
