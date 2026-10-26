import { useEffect } from "react";
import ScrollFilm from "./components/ScrollFilm";
import Shop from "./components/Shop";
import Footer from "./components/Footer";

export default function App() {
  useEffect(() => {
    if (window.__ambarCheckoutLoading) return;
    window.__ambarCheckoutLoading = true;
    window.CHECKOUT_CONFIG = {
      house: "AVEN",
      logo: "/logo.png",
      storeKey: "co-bag:/ambar",
    };
    const script = document.createElement("script");
    script.src = "/checkout.js";
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  return (
    <>
      <ScrollFilm />
      <Shop />
      <Footer />
    </>
  );
}
