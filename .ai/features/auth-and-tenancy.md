# Feature: Auth and Tenancy

## Purpose

Authenticate users and scope all customer data to the correct tenant/client context.

## Current contract

- Browser clients authenticate through the API.
- Auth state is carried by httpOnly cookies: `access_token` and `refresh_token`.
- Browser requests must use `credentials: 'include'`.
- API session payloads include `clientId` and `sub`.
- Server-side queries must scope by tenant/client and user/owner where appropriate.

## Tenant routing

- Customer paths use `/{clientId}/...`.
- Runtime client config comes from `public/clients/app.json` or `public/clients/app.dev.json`.
- Client config controls feature flags and some runtime URLs.

## Agent notes

- Do not reintroduce Firebase browser bootstrap for active flows.
- Do not store access/refresh tokens in browser JavaScript-accessible storage.
- Changes here often affect web, admin, API, and shared types.
