import { lazy } from 'react';

const Schema = lazy(() => import('@app/pages/Schema'));
const SpaceCreate = lazy(() => import('@app/pages/Schema/SpaceCreate'));
const SchemaConfig = lazy(() => import('@app/pages/Schema/SchemaConfig'));
const Import = lazy(() => import('@app/pages/Import'));
const TaskCreate = lazy(() => import('@app/pages/Import/TaskCreate'));


export const RoutesList = [
  {
    path: '/schema',
    component: Schema,
    exact: true,
  },
  {
    path: '/schema/space/create',
    component: SpaceCreate,
    exact: true,
  },
  {
    path: '/schema/:space/:type?/:action?/:module?',
    component: SchemaConfig,
  },
  {
    path: '/import/create',
    component: TaskCreate,
    exact: true,
  },
  {
    path: '/import/:type',
    component: Import,
  },
];

export const MENU_LIST = [
  {
    key: 'schema',
    path: '/schema',
    track: {
      category: 'navigation',
      action: 'view_schema',
      label: 'from_navigation'
    },
    icon: 'icon-nav-schema',
    intlKey: 'common.schema'
  },
  {
    key: 'import',
    path: '/import/files',
    track: {
      category: 'navigation',
      action: 'view_import',
      label: 'from_navigation'
    },
    icon: 'icon-btn-download',
    intlKey: 'common.import'
  },
  {
    key: 'console',
    path: '/console',
    track: {
      category: 'navigation',
      action: 'view_console',
      label: 'from_navigation'
    },
    icon: 'icon-nav-console',
    intlKey: 'common.console'
  },
];