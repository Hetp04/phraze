# Project-Level Sharing: Overview and Core Principles

## Overview

This document provides an **extremely detailed specification** for implementing a project-level sharing system that replaces the existing company-level invite functionality. The new system allows users to share **individual projects** with other users via invite codes, while maintaining strict access control so that invited users can **only access the specific shared project** and nothing else from the owner's company.

---

## Core Principle: Project-Level Access Control

### The Fundamental Rule

**A user can only access a project if they are either:**
1. **The owner** of the company that owns the project (their `emailToCompanyDirectory` points to that company)
2. **An explicit member** of that specific project (listed in `Companies/{companyEmail}/projects/{projectId}/members/{userEmail}`)

**A user CANNOT access a project if:**
- They are not the owner AND not a member
- They belong to a different company (even if they're in the same company, they still need explicit membership for non-owned projects)

### Why This Matters

This ensures that when User A shares "Project X" with User B:
- User B gets access **ONLY** to "Project X"
- User B does **NOT** get access to User A's other projects ("Project Y", "Project Z", etc.)
- User B does **NOT** become part of User A's company
- User B remains in their own company (`emailToCompanyDirectory` stays unchanged)
- User B can collaborate in real-time on "Project X" with User A

---

## Key Differences from Old System

### Old System (Company-Level)
- User joins entire company
- User gets access to ALL projects in that company
- User's `emailToCompanyDirectory` changes to the new company
- Data migration happens
- User loses access to their original company's projects

### New System (Project-Level)
- User stays in their own company
- User gets access to ONLY the specific shared project
- User's `emailToCompanyDirectory` remains unchanged
- No data migration
- User keeps access to their own company's projects
- User can be a member of multiple projects from different companies

---

## Summary

This specification defines a complete project-level sharing system that:

1. **Replaces** company-level invites with project-specific invites
2. **Uses ShareModal** (same component as chat sharing) for generating and displaying invite codes
3. **Enforces strict access control** via Firebase rules and membership tracking
4. **Maintains user company ownership** - users stay in their own company
5. **Enables real-time collaboration** on shared projects
6. **Provides clear UI/UX** for both sharing and accepting invites

The system is designed to be secure, scalable, and user-friendly while maintaining backward compatibility where possible.
