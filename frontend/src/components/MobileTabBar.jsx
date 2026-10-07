import { HomeIcon, SearchIcon, LibraryIcon, PlusCircleIcon } from "./icons";

// The phone's main navigation: four large, labelled targets along the bottom edge, where a
// thumb reaches. It replaces the desktop sidebar (hidden by CSS at phone widths), whose six
// unlabeled icons were mostly pages that don't exist yet. Hidden on wide screens.
export default function MobileTabBar({ active, onHome, onSearch, onLibrary, onAdd }) {
  const tabs = [
    { id: "home", label: "Home", icon: <HomeIcon filled={active === "home"} />, onClick: onHome },
    { id: "search", label: "Search", icon: <SearchIcon />, onClick: onSearch },
    { id: "library", label: "Library", icon: <LibraryIcon filled={active === "library"} />, onClick: onLibrary },
    { id: "add", label: "Add", icon: <PlusCircleIcon />, onClick: onAdd },
  ];

  return (
    <nav className="m-tabbar" aria-label="Main navigation">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`m-tab ${active === tab.id ? "active" : ""}`}
          onClick={tab.onClick}
          aria-current={active === tab.id ? "page" : undefined}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
