import express from "express";
import * as productsRepository from "../repositories/productsRepository";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
   const products = await productsRepository.listProducts({ q: req.query.q as string | undefined });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const product = await productsRepository.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
});

export default router;
