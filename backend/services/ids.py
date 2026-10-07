import hashlib


def stable_id(prefix: str, *parts: str) -> str:
    """Deterministic, filesystem-safe track id for platforms with no short native id of their own.
    Same input always produces the same id, so re-importing a song reuses its cached download."""
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:20]
    return f"{prefix}_{digest}"
