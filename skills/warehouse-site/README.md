# warehouse-site

A website for a US warehouse (3PL / 海外仓) that helps it win sellers: a homepage that looks like a big warehouse, a quote calculator sellers use themselves at any hour, and an inquiry form that lands every lead in your inbox and in an owner-only list.

Live demo: https://warehouse.labpencil.com (made-up brand, example prices)

## What you get

- **Homepage**: services, proof numbers, how it works, rate card, a client-portal preview, location. Chinese and English.
- **/quote**: size + weight + monthly volume → monthly estimate and per-order cost, itemized
- **/contact**: the seller sends their details with the estimate attached; you get an email, they get a confirmation
- **/admin/inquiries**: every inquiry, newest first, marked New / Contacted / Won / Lost

Your words, numbers and prices all live in one file: `src/modules/warehouse/config.ts`.

## Use it

Tell your AI:

> Use warehouse-site to build my warehouse's website

New project from scratch? Use launch-kit first (or let your AI install app-foundation, db-connect, email-send and auth-login), then warehouse-site.

You set one variable: `WAREHOUSE_ADMIN_EMAILS` = your email. Never paste keys into a chat.
