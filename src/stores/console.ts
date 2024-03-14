import { action, makeObservable, observable } from 'mobx';
import type { Graph, GraphTypeElement } from '@/interfaces';
import { execGql } from '@/services';
import { type RootStore } from '.';

export class ConsoleStore {
  rootStore?: RootStore;

  graphs = observable.array<Graph>([]);
  graphTypeElements = observable.array<GraphTypeElement>([]);

  constructor(rootStore?: RootStore) {
    makeObservable(this, {
      // observable properties
      graphs: observable.shallow,
      rootStore: observable.ref,

      // actions
      updateGraphs: action,
      updateGraphTypes: action,
    });
    this.rootStore = rootStore;
  }

  updateGraphs = (graphs: Graph[]) => this.graphs.replace(graphs);
  updateGraphTypes = (elements: GraphTypeElement[]) => this.graphTypeElements.replace(elements);

  getGraphTypes = async () => {
    const gql = `CALL show_graph_types() YIELD \`graph_type_name\` AS name CALL describe_graph_type(name) RETURN *`;
    const res = await execGql<{ tables: GraphTypeElement[] }>(gql);
    const elements = res?.tables || [];
    this.updateGraphTypes(elements);
  };
}
