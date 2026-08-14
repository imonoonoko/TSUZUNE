# O2-P3 Anonymous Apply/Rollback Prototype Purpose

## Problem

O2-P2 can deterministically preview classification moves, but it does not prove that active references can be rewritten or that every local mutation can be rolled back after success or failure.

## Target User

The sole TSUZUNE owner validating a future local classification-migration path before any production-Vault operation is allowed.

## Current Workaround

Keep physical moves disabled and represent classification through MOCs and Properties.

## Why Now

The project has no active Primary Track, and O2-P3 is an already-defined next gate that can be evaluated safely in a clean worktree with anonymous test data.

## Desired Outcome

An implementation-ready contract for a test-only prototype that applies an O2-P2 plan to an anonymous temporary Vault and then restores the exact pre-apply state.

## Success Definition

- The contract names all mutated state and required preimages.
- Acceptance covers successful apply, explicit rollback, and rollback after injected failures.
- Production Vault, Drive, installed TSUZUNE, MCP registration, and product UI remain untouched.
- The remaining Drive blocker is not converted into an apply permission.
