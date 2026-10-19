"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TextField,
  MenuItem,
  Button,
  FormControlLabel,
  Checkbox,
  Alert,
} from "@mui/material";
export default function DraftFields({
  record,
  setRecord,
  states,
}: {
  record: any;
  setRecord: (r: any) => void;
  states: string[];
}) {
  const buyers = useQuery({
    queryKey: ["document-buyer-identities"],
    queryFn: async () => {
      const r = await fetch("/api/admin/documents/organizations");
      if (!r.ok) throw new Error("Unable to load saved buyer identities");
      return r.json();
    },
  });
  const field = (key: string, value: any) =>
    setRecord({ ...record, [key]: value });
  const buyer = (key: string, value: any) =>
    field("buyer", { ...record.buyer, [key]: value });
  const item = (index: number, key: string, value: any) =>
    field(
      "items",
      record.items.map((i: any, n: number) =>
        n === index ? { ...i, [key]: value } : i,
      ),
    );
  return (
    <div className="draft-fields">
      <div className="draft-field-grid">
        <TextField
          label="GeM bid number"
          required
          value={record.bidNumber || ""}
          onChange={(e) => field("bidNumber", e.target.value || null)}
        />
        <TextField
          label="Original tender title"
          required
          value={record.title || ""}
          onChange={(e) => field("title", e.target.value || null)}
        />
        <TextField
          label="Original authorized source URL"
          required
          value={record.sourceUrl || ""}
          onChange={(e) => field("sourceUrl", e.target.value || null)}
        />
        <TextField
          label="Publication date"
          type="date"
          slotProps={{ inputLabel: { shrink: true } }}
          value={record.publishedAt || ""}
          onChange={(e) => field("publishedAt", e.target.value || null)}
        />
        <TextField
          label="Closing timestamp with timezone"
          placeholder="2026-10-30T15:00:00+05:30"
          value={record.closesAt || ""}
          onChange={(e) => field("closesAt", e.target.value || null)}
        />
        <TextField
          label="Explicit tender estimate (INR)"
          value={record.estimatedValue ?? ""}
          onChange={(e) => field("estimatedValue", e.target.value || null)}
        />
        <TextField
          label="Buyer institution"
          required
          value={record.buyer?.name || ""}
          onChange={(e) => buyer("name", e.target.value || null)}
        />
        <TextField
          label="Department"
          value={record.buyer?.department || ""}
          onChange={(e) => buyer("department", e.target.value || null)}
        />
        <TextField
          select
          label="Buyer state (leave unknown if unsupported)"
          value={record.buyer?.state || ""}
          onChange={(e) => buyer("state", e.target.value || null)}
        >
          <MenuItem value="">Unknown</MenuItem>
          {states.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Buyer district"
          value={record.buyer?.district || ""}
          onChange={(e) => buyer("district", e.target.value || null)}
        />
        <TextField
          select
          label="Match a saved buyer identity, if verified"
          value=""
          onChange={(e) => {
            const b = buyers.data?.find(
              (b: any) => b.source_key === e.target.value,
            );
            if (b)
              field("buyer", {
                ...record.buyer,
                key: b.source_key,
                name: b.name,
                state: b.state,
                district: b.district,
              });
          }}
        >
          <MenuItem value="">Keep extracted institution identity</MenuItem>
          {buyers.data?.map((b: any) => (
            <MenuItem key={b.source_key} value={b.source_key}>
              {b.name} · {b.state || "Unknown state"}
            </MenuItem>
          ))}
        </TextField>
      </div>
      {(!record.bidNumber ||
        !record.title ||
        !record.sourceUrl ||
        !record.buyer?.name ||
        !record.buyer?.key) && (
        <Alert severity="warning">
          Missing tender or buyer identity fields must be completed from the
          source before approval.
        </Alert>
      )}
      <h3>Requested equipment line items</h3>
      {(record.items || []).map((i: any, index: number) => (
        <div className="draft-item" key={i.key || index}>
          <div className="draft-field-grid">
            <TextField
              label="Original product name"
              required
              value={i.name || ""}
              onChange={(e) => item(index, "name", e.target.value)}
            />
            <TextField
              label="Requested quantity (blank = unknown)"
              value={i.quantity ?? ""}
              onChange={(e) => item(index, "quantity", e.target.value || null)}
            />
            <TextField
              label="Unit"
              value={i.unit || "unknown"}
              onChange={(e) => item(index, "unit", e.target.value || "unknown")}
            />
            <TextField
              label="Explicit line estimate (INR)"
              value={i.estimatedValue ?? ""}
              onChange={(e) =>
                item(index, "estimatedValue", e.target.value || null)
              }
            />
          </div>
          <TextField
            fullWidth
            multiline
            label="Item source evidence and page reference"
            required
            value={i.evidence || ""}
            onChange={(e) => item(index, "evidence", e.target.value)}
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={7}
            label="Extracted product specifications"
            value={i.specifications || ""}
            onChange={(e) =>
              item(index, "specifications", e.target.value || null)
            }
          />
          {(i.destinations || []).map((d: any, n: number) => {
            const update = (key: string, value: any) =>
              item(
                index,
                "destinations",
                i.destinations.map((v: any, k: number) =>
                  k === n ? { ...v, [key]: value } : v,
                ),
              );
            return (
              <div className="draft-destination" key={n}>
                <h4>Delivery destination {n + 1}</h4>
                <div className="draft-field-grid">
                  <TextField
                    select
                    label="Actual delivery state"
                    value={d.state || ""}
                    onChange={(e) => update("state", e.target.value)}
                  >
                    <MenuItem value="">Select source-supported state</MenuItem>
                    {states.map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Delivery district"
                    value={d.district || ""}
                    onChange={(e) =>
                      update("district", e.target.value || undefined)
                    }
                  />
                  <TextField
                    label="Explicit allocated quantity (blank = unknown)"
                    value={d.quantity ?? ""}
                    onChange={(e) => update("quantity", e.target.value || null)}
                  />
                </div>
                <TextField
                  label="Destination evidence / page reference"
                  fullWidth
                  value={d.evidence || ""}
                  onChange={(e) => update("evidence", e.target.value)}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!d.confirmed}
                      onChange={(e) => update("confirmed", e.target.checked)}
                    />
                  }
                  label="The source confirms this delivery destination."
                />
                <Button
                  size="small"
                  onClick={() =>
                    item(
                      index,
                      "destinations",
                      i.destinations.filter((_: any, k: number) => k !== n),
                    )
                  }
                >
                  Remove destination
                </Button>
              </div>
            );
          })}
          <div className="view-tools">
            <Button
              size="small"
              onClick={() =>
                item(index, "destinations", [
                  ...(i.destinations || []),
                  { state: "", quantity: null, confirmed: false, evidence: "" },
                ])
              }
            >
              Add source-supported delivery destination
            </Button>
            <Button
              size="small"
              color="error"
              onClick={() =>
                field(
                  "items",
                  record.items.filter((_: any, n: number) => n !== index),
                )
              }
            >
              Remove line item
            </Button>
          </div>
        </div>
      ))}
      <Button
        onClick={() =>
          field("items", [
            ...(record.items || []),
            {
              key: "review-item-" + crypto.randomUUID(),
              name: "",
              quantity: null,
              unit: "unknown",
              estimatedValue: null,
              evidence: "",
              destinations: [],
            },
          ])
        }
      >
        Add a missing source line item
      </Button>
    </div>
  );
}
