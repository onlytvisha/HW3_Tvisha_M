"use client";

import { BarChart3, TableIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type TableColumn = {
  header: string;
  /** Right-align and use tabular figures. */
  numeric?: boolean;
  cell: (row: Record<string, unknown>) => React.ReactNode;
};

/**
 * Chart frame with a matching table view.
 *
 * The table is not a fallback nobody sees - it is how someone reads exact
 * values, and how a screen reader or a colourblind reader gets everything the
 * bars encode. Both views read the same rows, so they cannot drift apart.
 */
export function ChartCard({
  title,
  caption,
  rows,
  columns,
  children,
}: {
  title: string;
  caption?: string;
  rows: Record<string, unknown>[];
  columns: TableColumn[];
  children: React.ReactNode;
}) {
  return (
    <Card className="sw-card">
      <CardContent className="px-5">
        <Tabs defaultValue="chart">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{title}</h2>
              {caption && (
                <p className="text-sw-text-dim mt-1 max-w-2xl text-sm leading-relaxed">
                  {caption}
                </p>
              )}
            </div>

            <TabsList className="bg-sw-surface-2/70 shrink-0">
              <TabsTrigger value="chart" className="gap-1.5 text-xs">
                <BarChart3 className="size-3.5" aria-hidden="true" />
                Chart
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-1.5 text-xs">
                <TableIcon className="size-3.5" aria-hidden="true" />
                Table
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="chart" className="mt-6">
            {children}
          </TabsContent>

          <TabsContent value="table" className="mt-6">
            <div className="max-h-[28rem] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-sw-line/60 hover:bg-transparent">
                    {columns.map((col) => (
                      <TableHead
                        key={col.header}
                        className={col.numeric ? "text-right" : undefined}
                      >
                        {col.header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow
                      key={i}
                      className="border-sw-line/40 hover:bg-sw-surface-2/40"
                    >
                      {columns.map((col) => (
                        <TableCell
                          key={col.header}
                          className={
                            col.numeric ? "tnum text-right" : undefined
                          }
                        >
                          {col.cell(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
