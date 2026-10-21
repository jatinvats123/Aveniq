// Demo accounts for the deployed app: one buyer and one seller with a few listings,
// so a reviewer can try the whole flow without registering. Unlike ../seed.js, which
// fills an empty Docker volume with a fixed dev password, this is safe to run against
// a live database: it only creates or updates the two demo users and the demo
// seller's own listings, and running it again changes nothing.
//
//   MONGO_URI=... DEMO_BUYER_PASSWORD=... DEMO_SELLER_PASSWORD=... npm run seed:demo
//
// The passwords come from the environment so they are never committed.
import dotenv from "dotenv";
import mongoose from "mongoose";
import userModel from "../src/models/user.model.js";
import productModel from "../src/models/productModel.js";

dotenv.config();

// Same minimum length the register and reset-password validators enforce.
const MIN_PASSWORD_LENGTH = 8;
const STOCK_PER_VARIANT = 50;

const DEMO_USERS = [
  {
    email: "buyer@aveniq.demo",
    contact: "9000000002",
    fullName: "Demo Buyer",
    role: "buyer",
    passwordVar: "DEMO_BUYER_PASSWORD",
  },
  {
    email: "seller@aveniq.demo",
    contact: "9000000001",
    fullName: "Demo Seller",
    role: "seller",
    passwordVar: "DEMO_SELLER_PASSWORD",
  },
];

const unsplash = (photo) => `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1000&q=80`;

const SIZES = ["S", "M", "L", "XL"].map((Size) => ({ attributes: { Size } }));
const BLACK_TOTE = unsplash("photo-1572196284554-4e321b0e7e0b");
const NATURAL_TOTE = unsplash("photo-1544816155-12df9643f363");

const DEMO_PRODUCTS = [
  {
    title: "Hand-Knit Crew Sweater",
    description:
      "Chunky hand-knit crew neck in warm cinnamon brown, with a relaxed fit for layering.",
    amount: 2799,
    images: [unsplash("photo-1773747310662-e7cc9e681226")],
    variants: SIZES,
  },
  {
    title: "Brushed Check Overshirt",
    description: "Soft brushed-cotton overshirt in a muted check, made to wear open over a tee.",
    amount: 2299,
    images: [unsplash("photo-1662578354822-f8b43ecaeaaa")],
    variants: SIZES,
  },
  {
    title: "Everyday Tote Bag",
    description:
      "Roomy tote with long handles for daily errands, a laptop or a weekend market run.",
    amount: 999,
    images: [BLACK_TOTE, NATURAL_TOTE],
    variants: [
      { attributes: { Colour: "Black" }, image: BLACK_TOTE },
      { attributes: { Colour: "Natural" }, image: NATURAL_TOTE },
    ],
  },
];

function checkEnv() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not defined in environment variables");
  }
  for (const { passwordVar } of DEMO_USERS) {
    if ((process.env[passwordVar] || "").length < MIN_PASSWORD_LENGTH) {
      throw new Error(`${passwordVar} must be set to at least ${MIN_PASSWORD_LENGTH} characters`);
    }
  }
}

// Create the user if missing. If it exists, keep its role and make sure its password
// matches the environment, so the credentials published in the README keep working.
async function ensureUser({ email, contact, fullName, role, passwordVar }) {
  const password = process.env[passwordVar];
  const user = await userModel.findOne({ email });

  if (!user) {
    // Registration refuses a contact number that another account already uses.
    if (await userModel.exists({ contact })) {
      throw new Error(`Contact ${contact} already belongs to another user; ${email} not created`);
    }
    // create() (not insertMany/updateOne) so the password-hashing pre-save hook runs.
    const created = await userModel.create({ email, contact, password, fullName, role });
    return { user: created, action: "created" };
  }

  if (user.role !== role) {
    throw new Error(`${email} already exists with role "${user.role}"; refusing to change it`);
  }
  if (user.password && (await user.comparePassword(password))) {
    return { user, action: "unchanged" };
  }
  user.password = password; // re-hashed by the pre-save hook, as in resetPassword
  await user.save();
  return { user, action: "password updated" };
}

// Built the same way addProductVariant (product.controller.js) builds a variant.
const toVariant = (product, { attributes, image = product.images[0] }) => ({
  price: { amount: product.amount, currency: "INR" },
  images: [{ url: image }],
  attributes,
  stock: STOCK_PER_VARIANT,
  variantId: new mongoose.Types.ObjectId(),
});

// Create each demo listing the seller doesn't have yet (matched by title), so a re-run
// restores a listing a visitor deleted but never duplicates one.
async function ensureProducts(sellerId) {
  const created = [];
  for (const product of DEMO_PRODUCTS) {
    if (await productModel.exists({ seller: sellerId, title: product.title })) continue;
    await productModel.create({
      title: product.title,
      description: product.description,
      seller: sellerId,
      price: { amount: product.amount, currency: "INR" },
      images: product.images.map((url) => ({ url })),
      variants: product.variants.map((variant) => toVariant(product, variant)),
    });
    created.push(product.title);
  }
  return created;
}

async function seedDemo() {
  checkEnv();
  await mongoose.connect(process.env.MONGO_URI);
  try {
    let seller;
    for (const demoUser of DEMO_USERS) {
      const { user, action } = await ensureUser(demoUser);
      console.log(`${demoUser.email}: ${action}`);
      if (demoUser.role === "seller") seller = user;
    }

    const created = await ensureProducts(seller._id);
    console.log(
      created.length > 0
        ? `Created ${created.length} demo listing(s): ${created.join(", ")}`
        : "Demo listings already present",
    );
  } finally {
    await mongoose.disconnect();
  }
}

seedDemo().catch((err) => {
  console.error("Demo seed failed:", err.message);
  process.exit(1);
});
