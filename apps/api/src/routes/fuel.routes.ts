import { Router } from "express";
import {
  getNearbyFuelController,
  getRouteFuelController,
  getRouteFuelRealController
} from "../controllers/fuel.controller.js";

export const fuelRouter = Router();

fuelRouter.get("/nearby", getNearbyFuelController);
fuelRouter.get("/route", getRouteFuelController);
fuelRouter.get("/route-real", getRouteFuelRealController);
