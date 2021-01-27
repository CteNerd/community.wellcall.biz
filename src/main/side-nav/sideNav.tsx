import React, { useState } from "react";
import {
  CaretDownOutlined,
  HomeOutlined,
  GithubOutlined,
  InfoCircleOutlined,
  UsergroupAddOutlined,
  InstagramOutlined,
  FacebookOutlined,
  AppstoreAddOutlined,
  SolutionOutlined,
  RocketOutlined,
  TrophyOutlined,
  UploadOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import "./sideNav.css";

export default function SideNav() {
  const [showLuckDropdown, setShowLuckDropdown] = useState(false);
  const [showSocialDropdown, setShowSocialDropdown] = useState(false);

  function closeNav() {
    if (document.getElementById("mySidenav"))
      document.getElementById("mySidenav")!.style.width = "0";
  }

  return (
    <div id="mySidenav" className="sidenav">
      <div className="closebtn" onClick={closeNav}>
        &times;
      </div>
      <a href="/">
        <HomeOutlined /> Home
      </a>
      <a href="/about">
        <InfoCircleOutlined /> About
      </a>
      <a href="/communities">
        <TeamOutlined /> Communities
      </a>
      <button
        onClick={() => setShowLuckDropdown(!showLuckDropdown)}
        className="dropdown-btn"
      >
        <ThunderboltOutlined /> Recharge
        <CaretDownOutlined className={"fa-caret-down"} />
      </button>
      <div
        className="dropdown-container"
        style={{ display: showLuckDropdown ? "block" : "none" }}
      >
        <a href="/recharge">
          <RocketOutlined /> Submit Your Business
        </a>
        <a href="/recharged">
          <TrophyOutlined /> Winners Circle
        </a>
      </div>
      <button
        onClick={() => setShowSocialDropdown(!showSocialDropdown)}
        className="dropdown-btn"
      >
        <UsergroupAddOutlined /> Social
        <CaretDownOutlined className={"fa-caret-down"} />
      </button>
      <div
        className="dropdown-container"
        style={{ display: showSocialDropdown ? "block" : "none" }}
      >
        <a
          href="https://www.facebook.com/Well-Call-Community-102031021904914"
          target={"_blank"}
        >
          <FacebookOutlined /> Facebook
        </a>
        <a href="https://www.instagram.com/WellCallCommunity/" target={"_blank"}>
          <InstagramOutlined /> Instagram
        </a>
      </div>
    </div>
  );
}
