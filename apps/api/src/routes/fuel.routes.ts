import { Router } from "express";
import { getNearbyFuelController } from "../controllers/fuel.controller.js";

export const fuelRouter = Router();

fuelRouter.get("/nearby", getNearbyFuelController);
