import { Router } from "express";
import { reverseGeoController, searchGeoController } from "../controllers/geo.controller.js";

export const geoRouter = Router();

geoRouter.get("/search", searchGeoController);
geoRouter.get("/reverse", reverseGeoController);
