"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Package,
  Plus,
  Minus,
  Search,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ImageUpload } from "@/components/ui/image-upload";
import { useAppStore } from "@/lib/store/app-store";
import { formatCurrency } from "@/lib/utils";

const LOW_STOCK_THRESHOLD = 12;

export default function OwnerInventoryPage() {
  const products = useAppStore((s) => s.products);
  const updateProduct = useAppStore((s) => s.updateProduct);
  const addProduct = useAppStore((s) => s.addProduct);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "Styling",
    price: 40,
    stock: 20,
    sku: "",
    imageUrl: undefined as string | undefined,
  });

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))),
    [products],
  );

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "all" || p.category === categoryFilter;
      const matchLow = !showLowOnly || p.stock <= LOW_STOCK_THRESHOLD;
      return matchSearch && matchCat && matchLow;
    });
  }, [products, search, categoryFilter, showLowOnly]);

  const lowStock = products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD);
  const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);

  function adjustStock(id: string, delta: number) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const next = Math.max(0, p.stock + delta);
    updateProduct(id, { stock: next });
    toast.success("Stock updated", {
      description: `${p.name}: ${p.stock} → ${next}`,
    });
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const sku =
      form.sku.trim() ||
      `SKU-${form.name.slice(0, 3).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
    addProduct({
      name: form.name.trim(),
      category: form.category,
      price: Number(form.price) || 0,
      stock: Number(form.stock) || 0,
      sku,
      imageUrl: form.imageUrl,
    });
    toast.success("Product added", { description: form.name });
    setForm({
      name: "",
      category: "Styling",
      price: 40,
      stock: 20,
      sku: "",
      imageUrl: undefined,
    });
    setOpenAdd(false);
  }

  function stockStatus(stock: number) {
    if (stock <= 5) return { label: "Critical", variant: "danger" as const };
    if (stock <= LOW_STOCK_THRESHOLD)
      return { label: "Low", variant: "warning" as const };
    return { label: "In Stock", variant: "success" as const };
  }

  return (
    <>
      <Topbar
        title="Inventory"
        actions={
          <div className="flex items-center gap-2">
            {lowStock.length > 0 && (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {lowStock.length} low stock
              </Badge>
            )}
            <Button size="sm" onClick={() => setOpenAdd(true)}>
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </div>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs text-[var(--text-faint)]">SKUs</p>
              <p className="font-display text-2xl font-semibold">{products.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--text-faint)]">Total Units</p>
              <p className="font-display text-2xl font-semibold">{totalUnits}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--text-faint)]">Retail Value</p>
              <p className="font-display text-2xl font-semibold text-[var(--gold-soft)]">
                {formatCurrency(totalValue)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--text-faint)]">Low Stock Alerts</p>
              <p className="font-display text-2xl font-semibold text-[var(--warning)]">
                {lowStock.length}
              </p>
            </Card>
          </div>

          {lowStock.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-4"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--warning)]" />
                <div>
                  <p className="font-medium text-[var(--warning)]">Low stock warning</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {lowStock.map((p) => p.name).join(", ")} — reorder soon.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
              <Input
                className="pl-10"
                placeholder="Search products or SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowLowOnly(!showLowOnly)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                showLowOnly
                  ? "bg-[var(--warning)]/15 text-[var(--warning)] ring-1 ring-[var(--warning)]/30"
                  : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
              }`}
            >
              Low Stock Only
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product, i) => {
              const status = stockStatus(product.stock);
              const stockPct = Math.min(100, (product.stock / 50) * 100);
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className="p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex gap-3">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-12 w-12 rounded-xl object-cover ring-1 ring-[var(--border)]"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-muted)]">
                            <Package className="h-5 w-5 text-[var(--gold)]" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-[var(--text-faint)]">
                            {product.sku} · {product.category}
                          </p>
                        </div>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>

                    <div className="mb-3">
                      <ImageUpload
                        label="Product image"
                        value={product.imageUrl}
                        onChange={(imageUrl) =>
                          updateProduct(product.id, { imageUrl })
                        }
                        previewClassName="h-20 w-20"
                      />
                    </div>

                    <div className="mb-3">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-[var(--text-muted)]">Stock level</span>
                        <span className="font-semibold">{product.stock} units</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            product.stock <= 5
                              ? "bg-[var(--danger)]"
                              : product.stock <= LOW_STOCK_THRESHOLD
                                ? "bg-[var(--warning)]"
                                : "gold-gradient"
                          }`}
                          style={{ width: `${stockPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mb-4 flex items-center justify-between">
                      <span className="font-display text-lg font-semibold text-[var(--gold-soft)]">
                        {formatCurrency(product.price)}
                      </span>
                      <span className="text-xs text-[var(--text-faint)]">
                        Value: {formatCurrency(product.price * product.stock)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => adjustStock(product.id, -1)}
                        disabled={product.stock <= 0}
                      >
                        <Minus className="h-4 w-4" />
                        Remove
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => adjustStock(product.id, 1)}
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => adjustStock(product.id, 10)}
                      >
                        <Boxes className="h-4 w-4" />
                        +10
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <Card className="py-12 text-center text-[var(--text-muted)]">
              No products match your filters.
            </Card>
          )}
        </div>
      </PageTransition>

      <Modal
        open={openAdd}
        onOpenChange={setOpenAdd}
        title="Add Product"
        description="New retail SKU for POS & inventory"
      >
        <form onSubmit={handleAdd} className="space-y-3">
          <ImageUpload
            label="Product image"
            value={form.imageUrl}
            onChange={(imageUrl) => setForm({ ...form, imageUrl })}
          />
          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div>
              <Label>SKU</Label>
              <Input
                value={form.sku}
                placeholder="Auto if empty"
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Price (MYR)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Opening Stock</Label>
              <Input
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) =>
                  setForm({ ...form, stock: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <Button type="submit" className="w-full">
            Create Product
          </Button>
        </form>
      </Modal>
    </>
  );
}
