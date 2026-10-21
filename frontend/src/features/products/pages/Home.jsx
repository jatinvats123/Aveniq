import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router";
import { useProduct } from "../hooks/useProduct";
import Navbar from "../../../components/Navbar";
import ProductCard from "../components/ProductCard";
import ProductCardSkeleton from "../components/ProductCardSkeleton";

const HERO_VIDEO_TRIM_END = 1; // seconds trimmed off the tail for a seamless loop
const SEARCH_DEBOUNCE_MS = 400;

const Home = () => {
  const products = useSelector((state) => state.product.products);
  const navigate = useNavigate();
  const location = useLocation();
  const { handleGetAllProducts, handleLoadMoreProducts } = useProduct();
  const [liveTime, setLiveTime] = useState(() => new Date());
  const heroVideoRef = useRef(null);
  const searchInputRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isFirstRun = useRef(true);

  const activeFilters = {
    q: searchTerm.trim() || undefined,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
    sort,
  };
  const hasActiveFilters = Boolean(searchTerm || minPrice || maxPrice || sort !== "newest");

  const handleClearFilters = () => {
    setSearchTerm("");
    setMinPrice("");
    setMaxPrice("");
    setSort("newest");
  };

  // Stable so the memoized ProductCards don't re-render on every clock tick.
  const handleSelect = useCallback((id) => navigate(`/product/${id}`), [navigate]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      const data = await handleLoadMoreProducts({ ...activeFilters, page: nextPage });
      if (data?.pagination) setPagination(data.pagination);
      setPage(nextPage);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });

  useEffect(() => {
    const fetchProducts = () => {
      setIsLoading(true);
      handleGetAllProducts({ ...activeFilters, page: 1 })
        .then((data) => {
          if (data?.pagination) setPagination(data.pagination);
          setPage(1);
        })
        .catch((err) => console.error("Failed to load products:", err))
        .finally(() => setIsLoading(false));
    };

    if (isFirstRun.current) {
      isFirstRun.current = false;
      fetchProducts();
      return;
    }

    const timeoutId = setTimeout(fetchProducts, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, minPrice, maxPrice, sort]);

  useEffect(() => {
    if (!location.state?.focusSearch) return;

    const timeoutId = setTimeout(() => {
      searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      searchInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [location.state]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setLiveTime(new Date());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const videoEl = heroVideoRef.current;
    if (!videoEl) return;

    const handleTimeUpdate = () => {
      if (videoEl.duration && videoEl.currentTime >= videoEl.duration - HERO_VIDEO_TRIM_END) {
        videoEl.currentTime = 0;
        videoEl.play();
      }
    };

    videoEl.addEventListener("timeupdate", handleTimeUpdate);
    return () => videoEl.removeEventListener("timeupdate", handleTimeUpdate);
  }, []);

  return (
    <div className="min-h-screen bg-white text-black selection:bg-black/10">
      <Navbar variant="light" animatedBrand />

      {/* ── Hero: Video ── */}
      <section className="relative h-[99.6vh] min-h-[560px] overflow-hidden bg-[#f7f7f5]">
        <video
          ref={heroVideoRef}
          autoPlay
          muted
          playsInline
          preload="metadata"
          poster="/register-bg.png"
          className="absolute inset-0 h-full w-full object-cover object-top"
        >
          <source src="/hero-720.mp4" type="video/mp4" />
        </video>

        {/* Soft dark overlay — just enough depth */}
        <div className="absolute inset-0 bg-black/5" />
        <div className="absolute inset-0 bg-linear-to-b from-black/5 via-transparent to-white/40" />

        {/* Legibility scrim behind the headline only — keeps the rest of the video untouched */}
        <div className="absolute inset-x-0 bottom-0 h-[45%] bg-linear-to-t from-black/55 via-black/15 to-transparent" />

        {/* Live clock — top centre */}
        <div className="absolute left-1/2 top-20 -translate-x-1/2 text-center sm:top-24">
          <div className="inline-flex flex-wrap items-center justify-center gap-2 text-[9px] uppercase tracking-[0.3em] text-[rgba(0,0,0,0.88)] sm:text-[10px]">
            <span>India, Delhi</span>
            <span>|</span>
            <span>{dateFormatter.format(liveTime)}</span>
            <span>|</span>
            <span>{timeFormatter.format(liveTime)}</span>
            <span>IST</span>
          </div>
        </div>

        {/* Hero copy — bottom left */}
        <div className="absolute left-6 right-6 bottom-14 sm:left-10 sm:right-10 sm:bottom-20 lg:left-16 lg:right-16">
          <div className="max-w-3xl">
            <h1
              className="text-4xl font-normal leading-tight text-[#f7f3ea] sm:text-5xl md:text-6xl lg:text-7xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Elegance,
              <br />
              <span className="italic font-light">unspoken.</span>
            </h1>
          </div>
        </div>
      </section>

      {/* ── Products Section ── */}
      <main className="max-w-screen-xl mx-auto px-6 sm:px-10 lg:px-16 pt-24 pb-36">
        {/* Section header */}
        <div className="mb-14">
          <p className="text-[10px] uppercase tracking-[0.4em] text-black/60 mb-6">
            {hasActiveFilters ? "Search" : "New Arrivals"}
          </p>
          <div className="flex items-end justify-between gap-6">
            <h2 className="text-3xl sm:text-4xl font-light text-black leading-snug">
              Discover the
              <br />
              <span className="italic">collection.</span>
            </h2>
            <p className="hidden sm:block text-sm text-black/60 leading-relaxed max-w-xs text-right">
              Premium pieces designed for the modern individual who moves with quiet confidence.
            </p>
          </div>
        </div>

        {/* Search & filters */}
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-sm">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search the collection…"
              className="w-full border-0 border-b border-black/15 bg-transparent px-0 py-3 text-[15px] text-black placeholder:text-black/60 transition-all duration-300 focus:border-black focus:outline-none focus:ring-0"
            />
          </div>

          <div className="flex flex-wrap items-end gap-5">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-black/60">
                Min ₹
              </label>
              <input
                type="number"
                min="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
                className="w-20 border-0 border-b border-black/15 bg-transparent py-2 text-sm text-black placeholder:text-black/60 focus:border-black focus:outline-none focus:ring-0"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-black/60">
                Max ₹
              </label>
              <input
                type="number"
                min="0"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Any"
                className="w-20 border-0 border-b border-black/15 bg-transparent py-2 text-sm text-black placeholder:text-black/60 focus:border-black focus:outline-none focus:ring-0"
              />
            </div>
            <div>
              <label
                htmlFor="sort-select"
                className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-black/60"
              >
                Sort
              </label>
              <select
                id="sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort products"
                className="border-0 border-b border-black/15 bg-transparent py-2 text-sm text-black focus:border-black focus:outline-none focus:ring-0"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="pb-2 text-[11px] uppercase tracking-[0.25em] text-black/60 underline-offset-4 transition-colors hover:text-black hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Rule */}
        <div className="w-full h-px bg-black/8 mb-10" />

        {!isLoading && (
          <p className="mb-10 text-xs uppercase tracking-[0.25em] text-black/60">
            {pagination?.total ?? 0} {pagination?.total === 1 ? "piece" : "pieces"}
            {searchTerm ? ` for "${searchTerm}"` : ""}
          </p>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-x-8 gap-y-20 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-8 gap-y-20 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} onSelect={handleSelect} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-40 text-center">
            <p className="text-[10px] uppercase tracking-[0.35em] text-black/60">No Results</p>
            <h3 className="text-2xl font-light text-black">Nothing matches your search</h3>
            <p className="max-w-sm text-sm text-black/60 leading-relaxed">
              Try a different keyword or clear your filters to see the full collection.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-2 px-6 py-2.5 border border-black text-[11px] uppercase tracking-[0.3em] hover:bg-black hover:text-white transition-all duration-300"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {!isLoading && products?.length > 0 && page < pagination?.pages && (
          <div className="mt-20 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="px-8 py-3 border border-black text-[11px] uppercase tracking-[0.35em] hover:bg-black hover:text-white transition-all duration-300 disabled:opacity-50"
            >
              {isLoadingMore ? "Loading…" : "Load More"}
            </button>
          </div>
        )}
      </main>

      {/* Footer strip */}
      <footer className="border-t border-black/8 py-10 px-6 sm:px-10 lg:px-16 max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.35em] text-black/60">Aveniq</p>
          <p className="text-[10px] uppercase tracking-[0.25em] text-black/60">
            © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
