import "./styles.css";
import { mountRoomPage } from "./room";
import { mountLoginPage, mountDashboardPage } from "./admin";

function main() {
  const path = window.location.pathname;

  if (path === "/admin") {
    window.history.replaceState({}, "", "/admin/dashboard");
    mountDashboardPage();
    return;
  }

  if (path === "/admin/login") {
    mountLoginPage();
  } else if (path === "/admin/dashboard") {
    mountDashboardPage();
  } else {
    mountRoomPage();
  }
}

main();
