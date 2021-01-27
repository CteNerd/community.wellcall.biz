import React from "react";
import "./App.css";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import Home from "./main/home/home";
import About from "./main/about/about";
import Communities from "./main/communities/communities";
import RechargeSubmit from "./main/recharge/submit"
import RechargeWinners from "./main/recharge/winners"
import SideNav from "./main/side-nav/sideNav";
import logo from "./images/Community We'll Call Logo No Padding.png";
import { MailOutlined, PhoneOutlined } from "@ant-design/icons";

function App() {
  return (
    <div className="App">
      <SideNav />
      <header className="App-header">
        <div className="col-33 menu-btn" onClick={() => openNav()}>
          <div className="menu-line"></div>
          <div className="menu-line"></div>
          <div className="menu-line"></div>
        </div>
        <div className="col-33">
          <img src={logo} className="logo col-50" />
        </div>
        <div className="col-33"></div>
      </header>

      <div className="App-main">
        <Router>
          <Switch>
            <Route path="/communities">
              <Communities />
            </Route>
            <Route path="/recharged">
              <RechargeWinners />
            </Route>
            <Route path="/recharge">
              <RechargeSubmit />
            </Route>
            <Route path="/about">
              <About />
            </Route>
            <Route path="/">
              <Home />
            </Route>
          </Switch>
        </Router>
      </div>

      <footer className="App-footer">
        <div className="col-33">
          <a href={"mailto:admin@wellcall.biz"}>
            <MailOutlined />
          </a>
        </div>
        <div className="col-33">
          <button
            type="submit"
            onClick={() =>
              window.open(
                "https://www.facebook.com/Well-Call-Community-102031021904914",
                "_blank"
              )
            }
          >
            Follow Us On Facebook
          </button>
        </div>
        <div className="col-33">
          <a href={"tel:559-574-1056"}>
            <PhoneOutlined />
          </a>
        </div>
      </footer>
    </div>
  );
}

/* Set the width of the side navigation to 250px */
function openNav() {
  if (document.getElementById("mySidenav")) {
    document.getElementById("mySidenav")!.style.width = "250px";
  }
}

export default App;
