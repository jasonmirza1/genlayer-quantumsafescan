"""Compatibility for the official direct runner's Windows temporary-file cleanup."""

import os

import pytest


@pytest.fixture
def direct_deploy_compat(direct_deploy, monkeypatch):
    pending = []
    original_unlink = os.unlink

    def unlink(path, *args, **kwargs):
        try:
            original_unlink(path, *args, **kwargs)
        except PermissionError:
            pending.append(path)

    if os.name == "nt":
        monkeypatch.setattr(os, "unlink", unlink)
    yield direct_deploy
    for path in pending:
        try:
            original_unlink(path)
        except (FileNotFoundError, PermissionError):
            pass
