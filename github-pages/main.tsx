import React from "react";
import { createRoot } from "react-dom/client";
import ShaderStudio from "../app/ShaderStudio";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) throw new Error("LUMEN could not find its application root.");

createRoot(root).render(
  <React.StrictMode>
    <ShaderStudio />
  </React.StrictMode>,
);
