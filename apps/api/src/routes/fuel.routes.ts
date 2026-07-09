import { Router } from "express";
import { getNearbyFuelController, getRouteFuelController } from "../controllers/fuel.controller.js";

export const fuelRouter = Router();

fuelRouter.get("/nearby", getNearbyFuelController);
fuelRouter.get("/route", getRouteFuelController);
