import { createContext, useContext } from 'react';
import { RouterStore, themeStore } from '@vesoft-inc/utils';
import { ModalStore } from '@vesoft-inc/ui-components';
import { CommonStore } from './common';
import GraphTypeStore from './graphtype';
import { ConsoleStore } from './console';

export class RootStore {
  commonStore = new CommonStore(this);
  routerStore = new RouterStore();
  graphtypeStore = new GraphTypeStore(this);
  themeStore = themeStore;
  modalStore = new ModalStore();
  consoleStore = new ConsoleStore(this);
}

const rootStore = new RootStore();

const rootStoreRef = { current: rootStore };

// @ts-ignore
window.studioStore = rootStore;

export const getRootStore = () => rootStoreRef.current;
export const storeContext = createContext(rootStore);
export const StoreProvider = storeContext.Provider;
export function useStore() {
  const store = useContext(storeContext);
  return store;
}
export function useModal() {
  const store = useStore();
  return store.modalStore;
}