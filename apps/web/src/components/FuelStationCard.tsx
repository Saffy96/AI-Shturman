import { motion } from "framer-motion";
import type { FuelStation } from "../types/fuel";
import { StationCard } from "./StationCard";

export function FuelStationCard({ station, index = 0 }: { station: FuelStation; index?: number }) {
  return <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.04 }}><StationCard station={station} /></motion.div>;
}
