import { Router } from "express";
import { searchGeoController } from "../controllers/geo.controller.js";

export const geoRouter = Router();

geoRouter.get("/search", searchGeoController);
