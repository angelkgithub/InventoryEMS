import { z } from "zod";

const MAX = 1_000_000;

const wholeNumber = (label: string) =>
  z
    .number({ error: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .min(0, `${label} cannot be below zero.`)
    .max(MAX, `${label} is too large.`);

export const adjustSchema = z
  .object({
    productId: z.uuid("Unknown product."),
    action: z.enum(["add", "remove", "set"]),
    quantity: wholeNumber("Quantity"),
    note: z.string().trim().max(500, "Note is too long.").optional(),
  })
  .refine((v) => v.action === "set" || v.quantity >= 1, {
    path: ["quantity"],
    message: "Enter a quantity of 1 or more.",
  });

const text = (max: number, label: string) => z.string().trim().max(max, `${label} is too long.`);

export const productFieldsSchema = z.object({
  name: z.string().trim().min(1, "Product name is required.").max(200, "Product name is too long."),
  sku: text(100, "SKU / NDC").optional(),
  category: text(60, "Category").optional(),
  lowStockThreshold: wholeNumber("Low stock alert"),
});

export const createProductSchema = productFieldsSchema.extend({ inventory: wholeNumber("Starting inventory") });
export const updateProductSchema = productFieldsSchema.extend({ productId: z.uuid("Unknown product.") });
export const archiveSchema = z.object({ productId: z.uuid("Unknown product."), active: z.boolean() });

export const firstIssue = (err: z.ZodError) => err.issues[0]?.message ?? "Please check the form and try again.";
