import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { Popup } from "./PopupApp";

createRoot(document.getElementById("root")!).render(<Popup />);
