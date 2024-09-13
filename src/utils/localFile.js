import fs from "fs";

export function deleteLocalFiles(filePath) {
  try {
    filePath.map((path) => {
      if (path !== null || path !== undefined) {
        try {
          fs.unlinkSync(path, () => {
            console.log(path, " Deleted...");
          });
        } catch (error) {
          console.log("Error deleting files from local path.", error);
        }
      }
    });
  } catch (error) {}
}
