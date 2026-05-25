import { Router } from "express";
import { z } from "zod";

import { optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { getLecturePlaybackUrlController } from "./media.controller.js";

const playbackUrlSchema = z.object({
  params: z.object({
    lectureId: z.string().min(1, "lectureId is required"),
  }),
});

const router = Router();

router.get(
  "/:lectureId/playback-url",
  optionalAuthenticate,
  validate(playbackUrlSchema),
  getLecturePlaybackUrlController
);

export default router;
