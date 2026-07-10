import type { ComponentProps } from "react";
import { Map } from "../Map";
export function MapContainer(props: ComponentProps<typeof Map>) { return <div className="absolute inset-0 bg-[#05070b]"><Map {...props} /></div>; }
