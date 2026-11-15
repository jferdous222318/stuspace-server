
import express from "express";
import multer from "multer";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 32 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

router.post("/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please select an image",
      });
    }

    const formData = new FormData();

    formData.append("key", process.env.IMGBB_API_KEY);
    formData.append(
      "image",
      new Blob([req.file.buffer], { type: req.file.mimetype }),
      req.file.originalname
    );

    const response = await fetch(
      "https://api.imgbb.com/1/upload",
      {
        method: "POST",
        body: formData,
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error("ImgBB error:", result);

      return res.status(400).json({
        message: result.error?.message || "Image upload failed",
      });
    }

    return res.status(200).json({
      message: "Image uploaded successfully",
      imageUrl: result.data.display_url,
    });
  } catch (error) {
    console.error("Image upload error:", error);

    return res.status(500).json({
      message: error.message || "Image upload failed",
    });
  }
});

export default router;
