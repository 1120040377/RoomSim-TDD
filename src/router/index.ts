import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/editor/:id',
    name: 'editor',
    component: () => import('@/views/EditorView.vue'),
    props: true,
  },
  {
    path: '/walkthrough/:id',
    name: 'walkthrough',
    component: () => import('@/views/WalkthroughView.vue'),
    props: true,
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
