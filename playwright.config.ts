import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',use:{baseURL:'http://localhost:3000',locale:'en-US',trace:'retain-on-failure'},reporter:'list'});
