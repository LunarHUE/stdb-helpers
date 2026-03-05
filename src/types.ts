import type {
  TypeBuilder,
  ColumnBuilder,
  ColumnMetadata,
  RowObj,
  ProductType,
  InferTypeOfRow,
  RowBuilder,
  ConnectionId,
  Identity,
  ScheduleAt,
  TimeDuration,
  Timestamp,
} from 'spacetimedb'

// Type implementations from non-exported spacetimedb packages
export type CoerceColumn<
  Col extends TypeBuilder<any, any> | ColumnBuilder<any, any, any>,
> =
  Col extends TypeBuilder<infer T, infer U>
    ? ColumnBuilder<T, U, ColumnMetadata<any>>
    : Col

export type CoerceRow<Row extends RowObj> = {
  [k in keyof Row & string]: CoerceColumn<Row[k]>
}

export type ParamsObj = Record<
  string,
  TypeBuilder<any, any> | ColumnBuilder<any, any, any>
>

export type UntypedReducerDef = {
  name: string
  accessorName: string
  params: CoerceRow<ParamsObj>
  paramsType: ProductType
}

export type UntypedTableDef = {
  sourceName: string;
  accessorName: string;
  columns: Record<string, ColumnBuilder<any, any, ColumnMetadata<any>>>;
  rowType: RowBuilder<RowObj>['algebraicType']['value'];
  isEvent?: boolean;
  // These are autogen types attached to the spacetimedb package that arent exported, we dont really need theme
  indexes: any;
  constraints: any;
  tableDef: any;
};

export type RowType<TableDef extends Pick<UntypedTableDef, 'columns'>> =
  InferTypeOfRow<TableDef['columns']>;

  type DoNotPrettify =
  | Identity
  | ConnectionId
  | Timestamp
  | TimeDuration
  | ScheduleAt;

/**
 * Utility to make TS show cleaner types by flattening intersections.
 */
export type Prettify<T> = T extends DoNotPrettify
  ? T
  : { [K in keyof T]: T[K] } & {};
