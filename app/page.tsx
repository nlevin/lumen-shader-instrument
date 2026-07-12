import type { Metadata } from "next";
import ShaderStudio from "./ShaderStudio";

export const metadata: Metadata = {
  title: "LUMEN — Shader Instrument",
  description: "A live WebGL shader instrument for shaping procedural light, motion, matter, and color.",
};

export default function Home() {
  return <ShaderStudio />;
}
