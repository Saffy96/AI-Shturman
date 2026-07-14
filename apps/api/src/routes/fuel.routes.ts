import { Router } from "express";
import {
  getNearbyFuelController,
  getFuelStationDetailsController,
  getRouteFuelController,
  getRouteFuelRealController,
  submitFuelStationReportController
} from "../controllers/fuel.controller.js";

export const fuelRouter = Router();

fuelRouter.get("/nearby", getNearbyFuelController);
fuelRouter.get("/stations/:osmId/details", getFuelStationDetailsController);
fuelRouter.post("/stations/:osmId/reports", submitFuelStationReportController);
fuelRouter.get("/route", getRouteFuelController);
fuelRouter.get("/route-real", getRouteFuelRealController);
