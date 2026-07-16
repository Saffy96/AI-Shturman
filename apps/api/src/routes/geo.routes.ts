import { Router } from "express";
import { autocompleteGeoController, reverseGeoController, searchGeoController } from "../controllers/geo.controller.js";
import { createRateLimiter } from "../middleware/rate-limit.middleware.js";

export const geoRouter = Router();

geoRouter.get("/autocomplete", createRateLimiter(60), autocompleteGeoController);
geoRouter.get("/search", createRateLimiter(30), searchGeoController);
geoRouter.get("/reverse", createRateLimiter(30), reverseGeoController);
