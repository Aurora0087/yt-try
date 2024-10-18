import multer from "multer";

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
      cb(null, './public/temp')
    },
  filename: function (req, file, cb) {
      
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + "-" + file.originalname);
    
    }
  })
  
export const upload = multer({ storage: storage,
  limits: {
    fileSize: 700 * 1024 * 1024, // Max file size: 700MB
  }
});