import { useState } from "react";
import { FRIENDS_LIST } from "../data/mockMusfluentData";
import { usePlayerStore } from "../store/playerStore";

export default function RightSidebar({ onOpenImport }) {
  const [friends, setFriends] = useState(FRIENDS_LIST);
  const showToast = usePlayerStore((s) => s.showToast);

  const toggleFollow = (id) => {
    setFriends((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const nextState = !f.isFollowing;
          showToast(nextState ? `Following ${f.name}` : `Unfollowed ${f.name}`);
          return { ...f, isFollowing: nextState };
        }
        return f;
      })
    );
  };

  return (
    <aside className="right-sidebar">
      {/* ── Friends Section ── */}
      <div className="friends-section">
        <div className="friends-header">
          <h3 className="friends-title">Friends</h3>
        </div>

        <div className="friends-list">
          {friends.map((friend) => (
            <div key={friend.id} className="friend-row">
              <div className="friend-avatar-wrap">
                <img src={friend.avatar} alt={friend.name} className="friend-avatar" />
              </div>

              <div className="friend-info">
                <span className="friend-name">{friend.name}</span>
                <span className="friend-status">{friend.status}</span>
              </div>

              <button
                className={`friend-follow-btn ${friend.isFollowing ? "following" : ""}`}
                onClick={() => toggleFollow(friend.id)}
              >
                {friend.isFollowing ? "Following" : "Follow"}
              </button>
            </div>
          ))}
        </div>

        <button
          className="friends-show-all-btn"
          onClick={() => showToast("Showing all 12 active friends")}
        >
          Show all
        </button>
      </div>

      {/* ── Gradient Premium Card ── */}
      <div className="premium-promo-card">
        <div className="promo-badge">Now</div>
        <h4 className="promo-title">Get Your Premium Now!</h4>
        <p className="promo-desc">
          Let's upgrade your music to premium and listen to songs without ads
        </p>
        <button
          className="promo-action-btn"
          onClick={() => {
            onOpenImport?.();
            showToast("ISIFY VIP: Unlimited downloads & high quality audio enabled!");
          }}
        >
          Get Premium
        </button>
      </div>
    </aside>
  );
}
