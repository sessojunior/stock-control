const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

export function getImageUrl(imagePath) {
  if (!imagePath || imagePath.startsWith("data:")) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return `${API_ORIGIN}${imagePath.startsWith("/") ? imagePath : `/${imagePath}`}`;
}

export class ApiError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = "ApiError";
    this.errors = errors;
  }
}

async function request(path, options = {}) {
  let response;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("Não foi possível conectar à API. Verifique se o backend está em execução.");
  }

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new ApiError(body.message || "Não foi possível concluir a operação.", body.errors || {});
  return body;
}

const withData = (body) => body.data || [];

function productFormData(payload) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (key === "image" || key === "imageFile" || value === null || value === undefined) continue;
    formData.append(key, String(value));
  }
  if (payload.imageFile) formData.append("image", payload.imageFile);
  return formData;
}

export const api = {
  createProduct: (payload) => request("/products", { method: "POST", body: JSON.stringify(payload) }),
  createSupplier: (payload) => request("/suppliers", { method: "POST", body: JSON.stringify(payload) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),
  deleteSupplier: (id) => request(`/suppliers/${id}`, { method: "DELETE" }),
  getProduct: async (id) => (await request(`/products/${id}`)).data,
  getProductSuppliers: async (id) => withData(await request(`/products/${id}/suppliers`)),
  getProducts: async () => withData(await request("/products")),
  getSupplier: async (id) => (await request(`/suppliers/${id}`)).data,
  getSupplierProducts: async (id) => withData(await request(`/suppliers/${id}/products`)),
  getSuppliers: async () => withData(await request("/suppliers")),
  removeSupplierAssociation: (productId, supplierId) => request(`/products/${productId}/suppliers/${supplierId}`, { method: "DELETE" }),
  saveProduct: (id, payload) => request(id ? `/products/${id}` : "/products", { method: id ? "PUT" : "POST", body: productFormData(payload) }),
  saveSupplier: (id, payload) => request(id ? `/suppliers/${id}` : "/suppliers", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) }),
  associateSupplier: (productId, supplierId) => request(`/products/${productId}/suppliers/${supplierId}`, { method: "POST" }),
};
