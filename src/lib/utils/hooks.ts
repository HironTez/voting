import autosize from "autosize";
import { useEffect } from "react";

export const useAutosize = () => {
  useEffect(() => {
    autosize(document.querySelectorAll("textarea"));
  });
};
