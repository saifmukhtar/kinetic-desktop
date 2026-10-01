import { getCurrentWindow } from "@tauri-apps/api/window";
import "./WindowResizer.css";

export default function WindowResizer() {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
  const win = isTauri ? getCurrentWindow() : null;

  return (
    <>
      <div className="resizer resizer-n"  onMouseDown={() => win?.startResizeDragging("North")} />
      <div className="resizer resizer-s"  onMouseDown={() => win?.startResizeDragging("South")} />
      <div className="resizer resizer-e"  onMouseDown={() => win?.startResizeDragging("East")} />
      <div className="resizer resizer-w"  onMouseDown={() => win?.startResizeDragging("West")} />
      <div className="resizer resizer-ne" onMouseDown={() => win?.startResizeDragging("NorthEast")} />
      <div className="resizer resizer-nw" onMouseDown={() => win?.startResizeDragging("NorthWest")} />
      <div className="resizer resizer-se" onMouseDown={() => win?.startResizeDragging("SouthEast")} />
      <div className="resizer resizer-sw" onMouseDown={() => win?.startResizeDragging("SouthWest")} />
    </>
  );
}
