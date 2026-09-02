import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, getImageUrl } from "./services/api";

const categories = ["Eletrônicos", "Alimentos", "Vestuário", "Limpeza", "Higiene", "Papelaria", "Outro"];
const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "products", label: "Produtos", icon: "box" },
  { id: "suppliers", label: "Fornecedores", icon: "truck" },
  { id: "associations", label: "Associações", icon: "link" },
];

function Icon({ name, size = 18 }) {
  const paths = {
    arrowRight: <path d="M5 12h14m-6-6 6 6-6 6" />,
    box: <><path d="m21 8-9 5-9-5 9-5 9 5Z" /><path d="m3 8 9 5 9-5v8l-9 5-9-5V8Z" /><path d="M12 13v8" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    external: <><path d="M14 3h7v7M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></>,
    grid: <><rect height="7" rx="1" width="7" x="3" y="3" /><rect height="7" rx="1" width="7" x="14" y="3" /><rect height="7" rx="1" width="7" x="3" y="14" /><rect height="7" rx="1" width="7" x="14" y="14" /></>,
    image: <><rect height="18" rx="2" width="18" x="3" y="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" /></>,
    truck: <><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></>,
    warning: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v4M12 17h.01" /></>,
  };
  return <svg aria-hidden="true" className="icon" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size}>{paths[name]}</svg>;
}

function formatCnpj(value = "") {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatPhone(value = "") {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  const middle = digits.length === 11 ? digits.slice(2, 7) : digits.slice(2, 6);
  return `(${digits.slice(0, 2)}) ${middle}-${digits.slice(digits.length === 11 ? 7 : 6)}`;
}

function formatDate(value) {
  if (!value) return "Sem validade";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function getErrorMessage(error) {
  return error instanceof ApiError ? error.message : "Não foi possível concluir a operação.";
}

function Field({ label, name, error, required = false, children, hint }) {
  return <div className="field"><label htmlFor={name}>{label}{required && <span className="required">*</span>}</label>{children}{hint && !error && <span className="field-hint">{hint}</span>}{error && <span className="field-error">{error}</span>}</div>;
}

function Button({ children, className = "", icon, onClick, type = "button", variant = "primary", disabled = false }) {
  const variantClasses = { primary: "bg-[#6557e8] text-white shadow-[0_7px_15px_#6557e82e] hover:bg-[#5448ce]", secondary: "bg-[#eeecff] text-[#5c4ed4] hover:bg-[#e4e0ff]", ghost: "bg-[#f4f5f9] text-[#6f778d] hover:bg-[#e9ebf2]", danger: "bg-[#e95868] text-white hover:bg-[#d94b5b]" }[variant];
  return <button className={`button inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${variantClasses} ${className}`} disabled={disabled} onClick={onClick} type={type}>{icon && <Icon name={icon} size={16} />}{children}</button>;
}

function Modal({ title, description, children, onClose, wide = false }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className={`modal ${wide ? "modal-wide" : ""}`} onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>{children}</div></div>;
}

function Toast({ toast }) {
  if (!toast) return null;
  return <div className={`toast toast-${toast.type}`} role="status"><span className="toast-mark"><Icon name={toast.type === "success" ? "check" : "warning"} size={15} /></span><span>{toast.message}</span></div>;
}

function EmptyState({ icon = "box", title, description, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={24} /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

function LoadingRows({ columns = 4 }) {
  return <>{[1, 2, 3].map((row) => <div className="skeleton-row" key={row}>{Array.from({ length: columns }, (_, index) => <span className="skeleton" key={index} />)}</div>)}</>;
}

function ProductFormModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState({ name: product?.name || "", barcode: product?.barcode || "", description: product?.description || "", stockQuantity: product?.stockQuantity ?? "", category: product?.category || "", customCategory: product?.customCategory || "", expirationDate: product?.expirationDate || "", image: product?.image || "", imageFile: null });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function handleImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    updateField("imageFile", file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await api.saveProduct(product?.id, { ...form, stockQuantity: form.stockQuantity === "" ? 0 : Number(form.stockQuantity), customCategory: form.category === "Outro" ? form.customCategory : null, expirationDate: form.expirationDate || null });
      onSaved(response.message);
    } catch (error) {
      setErrors(error instanceof ApiError ? error.errors : { _form: getErrorMessage(error) });
      if (error instanceof ApiError && !Object.keys(error.errors).length) setErrors({ _form: error.message });
    } finally { setSaving(false); }
  }

  return <Modal description={product ? "Atualize os dados deste item." : "Cadastre um item para acompanhar sua operação."} onClose={onClose} title={product ? "Editar produto" : "Novo produto"} wide><form className="modal-form" onSubmit={handleSubmit}>{errors._form && <div className="form-error-banner"><Icon name="warning" size={16} />{errors._form}</div>}<div className="form-grid form-grid-two"><Field error={errors.name} label="Nome do produto" name="name" required><input autoFocus id="name" onChange={(event) => updateField("name", event.target.value)} placeholder="Ex.: Café Torrado 500g" value={form.name} /></Field><Field error={errors.barcode} hint="Os zeros à esquerda são preservados." label="Código de barras" name="barcode"><input id="barcode" inputMode="numeric" onChange={(event) => updateField("barcode", event.target.value.replace(/\D/g, ""))} placeholder="Ex.: 7891234567890" value={form.barcode} /></Field></div><Field error={errors.description} label="Descrição" name="description" required><textarea id="description" onChange={(event) => updateField("description", event.target.value)} placeholder="Descreva brevemente o produto" rows="3" value={form.description} /></Field><div className="form-grid form-grid-three"><Field error={errors.stockQuantity} label="Quantidade em estoque" name="stockQuantity"><input id="stockQuantity" min="0" onChange={(event) => updateField("stockQuantity", event.target.value)} placeholder="0" type="number" value={form.stockQuantity} /></Field><Field error={errors.category} label="Categoria" name="category" required><div className="select-wrap"><select id="category" onChange={(event) => updateField("category", event.target.value)} value={form.category}><option value="">Selecione uma categoria</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><Icon name="chevronDown" size={16} /></div></Field><Field error={errors.expirationDate} label="Data de validade" name="expirationDate"><input id="expirationDate" onChange={(event) => updateField("expirationDate", event.target.value)} type="date" value={form.expirationDate} /></Field></div>{form.category === "Outro" && <Field error={errors.customCategory} label="Especifique a categoria" name="customCategory" required><input id="customCategory" onChange={(event) => updateField("customCategory", event.target.value)} placeholder="Ex.: Utilidades" value={form.customCategory} /></Field>}<Field error={errors.image} hint="JPG, PNG ou WEBP. Opcional." label="Imagem do produto" name="image"><label className="file-input" htmlFor="image"><Icon name={form.imageFile || form.image ? "check" : "upload"} size={16} /><span>{form.imageFile ? form.imageFile.name : form.image ? "Imagem atual" : "Escolher arquivo"}</span><input accept="image/png,image/jpeg,image/webp" id="image" onChange={handleImage} type="file" /></label></Field><div className="modal-actions"><Button onClick={onClose} variant="ghost">Cancelar</Button><Button disabled={saving} icon={saving ? undefined : "check"} type="submit">{saving ? "Salvando..." : product ? "Salvar alterações" : "Cadastrar produto"}</Button></div></form></Modal>;
}

function SupplierFormModal({ supplier, onClose, onSaved }) {
  const [form, setForm] = useState({ companyName: supplier?.companyName || "", cnpj: supplier?.cnpj || "", address: supplier?.address || "", phone: supplier?.phone || "", email: supplier?.email || "", primaryContact: supplier?.primaryContact || "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try { const response = await api.saveSupplier(supplier?.id, form); onSaved(response.message); } catch (error) { setErrors(error instanceof ApiError ? (Object.keys(error.errors).length ? error.errors : { _form: error.message }) : { _form: getErrorMessage(error) }); } finally { setSaving(false); }
  }

  return <Modal description={supplier ? "Atualize os dados deste parceiro." : "Registre um parceiro para vinculá-lo aos seus produtos."} onClose={onClose} title={supplier ? "Editar fornecedor" : "Novo fornecedor"}><form className="modal-form" onSubmit={handleSubmit}>{errors._form && <div className="form-error-banner"><Icon name="warning" size={16} />{errors._form}</div>}<Field error={errors.companyName} label="Nome da empresa" name="companyName" required><input autoFocus id="companyName" onChange={(event) => updateField("companyName", event.target.value)} placeholder="Ex.: Distribuidora Central Ltda" value={form.companyName} /></Field><div className="form-grid form-grid-two"><Field error={errors.cnpj} hint="Informe os 14 dígitos do documento." label="CNPJ" name="cnpj" required><input id="cnpj" inputMode="numeric" onChange={(event) => updateField("cnpj", formatCnpj(event.target.value))} placeholder="00.000.000/0000-00" value={form.cnpj} /></Field><Field error={errors.phone} label="Telefone" name="phone" required><input id="phone" inputMode="tel" onChange={(event) => updateField("phone", formatPhone(event.target.value))} placeholder="(00) 0000-0000" value={form.phone} /></Field></div><Field error={errors.address} label="Endereço" name="address" required><input id="address" onChange={(event) => updateField("address", event.target.value)} placeholder="Rua, número, bairro, cidade - UF" value={form.address} /></Field><div className="form-grid form-grid-two"><Field error={errors.email} label="E-mail" name="email" required><input id="email" onChange={(event) => updateField("email", event.target.value)} placeholder="exemplo@fornecedor.com" type="email" value={form.email} /></Field><Field error={errors.primaryContact} label="Contato principal" name="primaryContact" required><input id="primaryContact" onChange={(event) => updateField("primaryContact", event.target.value)} placeholder="Nome do contato" value={form.primaryContact} /></Field></div><div className="modal-actions"><Button onClick={onClose} variant="ghost">Cancelar</Button><Button disabled={saving} icon={saving ? undefined : "check"} type="submit">{saving ? "Salvando..." : supplier ? "Salvar alterações" : "Cadastrar fornecedor"}</Button></div></form></Modal>;
}

function ProductDetailModal({ product, onClose }) {
  return <Modal description="Visão geral do item cadastrado." onClose={onClose} title="Detalhes do produto"><div className="detail-layout">{product.image ? <img alt={product.name} className="detail-image" src={getImageUrl(product.image)} /> : <div className="detail-image detail-image-placeholder"><Icon name="image" size={28} /></div>}<div className="detail-content"><div className="detail-topline"><span className="eyebrow">Produto #{product.id}</span><StockBadge quantity={product.stockQuantity} /></div><h3>{product.name}</h3><p>{product.description}</p><div className="detail-grid"><div><span>Código de barras</span><strong>{product.barcode || "Não informado"}</strong></div><div><span>Categoria</span><strong>{product.category === "Outro" ? product.customCategory : product.category}</strong></div><div><span>Estoque atual</span><strong>{formatNumber(product.stockQuantity)} un.</strong></div><div><span>Validade</span><strong>{formatDate(product.expirationDate)}</strong></div></div></div></div><div className="modal-actions"><Button onClick={onClose} variant="ghost">Fechar</Button></div></Modal>;
}

function ConfirmModal({ title, description, confirmLabel, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  async function confirm() { setBusy(true); await onConfirm(); setBusy(false); }
  return <Modal onClose={busy ? undefined : onClose} title={title}><div className="confirm-content"><span className="confirm-icon"><Icon name="warning" size={22} /></span><p>{description}</p></div><div className="modal-actions"><Button disabled={busy} onClick={onClose} variant="ghost">Cancelar</Button><Button disabled={busy} onClick={confirm} variant="danger">{busy ? "Aguarde..." : confirmLabel}</Button></div></Modal>;
}

function StockBadge({ quantity }) {
  if (quantity === 0) return <span className="status status-out">Sem estoque</span>;
  if (quantity < 10) return <span className="status status-low">Estoque baixo</span>;
  return <span className="status status-ok">Em estoque</span>;
}

function PageTitle({ eyebrow, title, description, action }) {
  return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function SearchBox({ value, onChange, placeholder = "Pesquisar..." }) {
  return <label className="search-box"><Icon name="search" size={17} /><input aria-label="Pesquisar" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} /></label>;
}

function DashboardPage({ products, suppliers, onNavigate }) {
  const lowStock = products.filter((product) => product.stockQuantity > 0 && product.stockQuantity < 10).length;
  const outOfStock = products.filter((product) => product.stockQuantity === 0).length;
  const stats = [{ label: "Produtos cadastrados", value: products.length, detail: "itens no catálogo", icon: "box", color: "purple" }, { label: "Fornecedores ativos", value: suppliers.length, detail: "parceiros registrados", icon: "truck", color: "blue" }, { label: "Estoque baixo", value: lowStock, detail: "itens para revisar", icon: "warning", color: "orange" }, { label: "Sem estoque", value: outOfStock, detail: "itens indisponíveis", icon: "grid", color: "rose" }];
  return <div className="page-stack"><PageTitle description="Acompanhe os principais indicadores da sua operação." eyebrow="Visão geral" title="Visão geral do estoque" action={<Button icon="plus" onClick={() => onNavigate("products")}>Novo produto</Button>} /><div className="stats-grid">{stats.map((stat) => <div className="stat-card" key={stat.label}><div className={`stat-icon stat-icon-${stat.color}`}><Icon name={stat.icon} size={19} /></div><div><span>{stat.label}</span><strong>{formatNumber(stat.value)}</strong><small>{stat.detail}</small></div></div>)}</div><div className="dashboard-grid"><section className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">Catálogo</span><h2>Produtos recentes</h2></div><button className="text-button" onClick={() => onNavigate("products")} type="button">Ver todos <Icon name="arrowRight" size={15} /></button></div>{products.length ? <div className="mini-list">{products.slice(0, 5).map((product) => <div className="mini-row" key={product.id}>{product.image ? <img alt="" className="mini-product-image" src={getImageUrl(product.image)} /> : <span className="mini-product-icon"><Icon name="box" size={16} /></span>}<div><strong>{product.name}</strong><small>{product.category === "Outro" ? product.customCategory : product.category} · {product.barcode || "Sem código"}</small></div><div className="mini-stock"><strong>{formatNumber(product.stockQuantity)}</strong><small>un.</small></div></div>)}</div> : <EmptyState description="Cadastre seu primeiro produto para começar." icon="box" title="Nenhum produto ainda" action={<Button onClick={() => onNavigate("products")} variant="secondary">Cadastrar produto</Button>} />}</section><section className="panel quick-panel"><div className="panel-heading"><div><span className="eyebrow">Atalhos</span><h2>Ações rápidas</h2></div></div><div className="quick-actions"><button onClick={() => onNavigate("products")} type="button"><span className="quick-icon purple-bg"><Icon name="box" size={18} /></span><span><strong>Gerenciar produtos</strong><small>Cadastre e atualize o estoque</small></span><Icon name="chevronRight" size={17} /></button><button onClick={() => onNavigate("suppliers")} type="button"><span className="quick-icon blue-bg"><Icon name="truck" size={18} /></span><span><strong>Gerenciar fornecedores</strong><small>Mantenha seus parceiros em dia</small></span><Icon name="chevronRight" size={17} /></button><button onClick={() => onNavigate("associations")} type="button"><span className="quick-icon green-bg"><Icon name="link" size={18} /></span><span><strong>Vincular fornecedores</strong><small>Organize sua cadeia de compras</small></span><Icon name="chevronRight" size={17} /></button></div></section></div></div>;
}

function ProductsPage({ products, loading, onNew, onEdit, onView, onDelete }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => products.filter((product) => `${product.name} ${product.barcode || ""} ${product.category}`.toLowerCase().includes(search.toLowerCase())), [products, search]);
  return <div className="page-stack"><PageTitle description="Cadastre, consulte e acompanhe os itens do seu estoque." eyebrow="Catálogo" title="Produtos" action={<Button icon="plus" onClick={onNew}>Novo produto</Button>} /><section className="panel table-panel"><div className="table-toolbar"><div><h2>Todos os produtos</h2><span>{products.length} {products.length === 1 ? "item cadastrado" : "itens cadastrados"}</span></div><SearchBox onChange={setSearch} placeholder="Buscar por nome, código ou categoria" value={search} /></div>{loading ? <LoadingRows columns={5} /> : filtered.length ? <div className="table-scroll"><table><thead><tr><th>Produto</th><th>Código de barras</th><th>Categoria</th><th>Estoque</th><th className="align-right">Ações</th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id}><td><div className="table-product">{product.image ? <img alt="" src={getImageUrl(product.image)} /> : <span><Icon name="box" size={16} /></span>}<div><strong>{product.name}</strong><small>ID #{product.id}</small></div></div></td><td className="muted-cell">{product.barcode || "—"}</td><td><span className="category-pill">{product.category === "Outro" ? product.customCategory : product.category}</span></td><td><div className="stock-cell"><strong>{formatNumber(product.stockQuantity)}</strong><StockBadge quantity={product.stockQuantity} /></div></td><td><div className="row-actions"><button aria-label={`Ver ${product.name}`} onClick={() => onView(product)} type="button"><Icon name="external" size={15} />Ver</button><button aria-label={`Editar ${product.name}`} onClick={() => onEdit(product)} type="button"><Icon name="edit" size={15} />Editar</button><button aria-label={`Excluir ${product.name}`} className="action-danger" onClick={() => onDelete(product)} type="button"><Icon name="trash" size={15} />Excluir</button></div></td></tr>)}</tbody></table></div> : <EmptyState description={search ? "Tente buscar por outro termo." : "Cadastre seu primeiro produto para começar a acompanhar o estoque."} icon="box" title={search ? "Nenhum resultado" : "Nenhum produto cadastrado"} action={!search && <Button icon="plus" onClick={onNew}>Cadastrar produto</Button>} />}</section></div>;
}

function SuppliersPage({ suppliers, loading, onNew, onEdit, onView, onDelete }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => suppliers.filter((supplier) => `${supplier.companyName} ${supplier.cnpj} ${supplier.email}`.toLowerCase().includes(search.toLowerCase())), [suppliers, search]);
  return <div className="page-stack"><PageTitle description="Gerencie os parceiros que abastecem o seu negócio." eyebrow="Relacionamentos" title="Fornecedores" action={<Button icon="plus" onClick={onNew}>Novo fornecedor</Button>} /><section className="panel table-panel"><div className="table-toolbar"><div><h2>Todos os fornecedores</h2><span>{suppliers.length} {suppliers.length === 1 ? "parceiro registrado" : "parceiros registrados"}</span></div><SearchBox onChange={setSearch} placeholder="Buscar por empresa, CNPJ ou e-mail" value={search} /></div>{loading ? <LoadingRows columns={4} /> : filtered.length ? <div className="table-scroll"><table><thead><tr><th>Empresa</th><th>CNPJ</th><th>Contato principal</th><th>Telefone</th><th className="align-right">Ações</th></tr></thead><tbody>{filtered.map((supplier) => <tr key={supplier.id}><td><div className="table-product"><span className="supplier-avatar"><Icon name="truck" size={16} /></span><div><strong>{supplier.companyName}</strong><small>ID #{supplier.id}</small></div></div></td><td className="muted-cell">{supplier.cnpj}</td><td><div className="contact-cell"><strong>{supplier.primaryContact}</strong><small>{supplier.email}</small></div></td><td className="muted-cell">{supplier.phone}</td><td><div className="row-actions"><button aria-label={`Ver ${supplier.companyName}`} onClick={() => onView(supplier)} type="button"><Icon name="external" size={15} />Ver</button><button aria-label={`Editar ${supplier.companyName}`} onClick={() => onEdit(supplier)} type="button"><Icon name="edit" size={15} />Editar</button><button aria-label={`Excluir ${supplier.companyName}`} className="action-danger" onClick={() => onDelete(supplier)} type="button"><Icon name="trash" size={15} />Excluir</button></div></td></tr>)}</tbody></table></div> : <EmptyState description={search ? "Tente buscar por outro termo." : "Adicione fornecedores para organizar seus parceiros."} icon="truck" title={search ? "Nenhum resultado" : "Nenhum fornecedor cadastrado"} action={!search && <Button icon="plus" onClick={onNew}>Cadastrar fornecedor</Button>} />}</section></div>;
}

function SupplierDetailModal({ supplier, onClose }) {
  return <Modal description="Informações do parceiro cadastrado." onClose={onClose} title="Detalhes do fornecedor"><div className="supplier-detail"><span className="supplier-detail-avatar"><Icon name="truck" size={25} /></span><span className="eyebrow">Fornecedor #{supplier.id}</span><h3>{supplier.companyName}</h3><div className="detail-list"><div><span>CNPJ</span><strong>{supplier.cnpj}</strong></div><div><span>Contato principal</span><strong>{supplier.primaryContact}</strong></div><div><span>E-mail</span><strong>{supplier.email}</strong></div><div><span>Telefone</span><strong>{supplier.phone}</strong></div><div><span>Endereço</span><strong>{supplier.address}</strong></div></div></div><div className="modal-actions"><Button onClick={onClose} variant="ghost">Fechar</Button></div></Modal>;
}

function AssociationsPage({ products, suppliers, loading, onAskConfirm, onToast }) {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || "");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [associated, setAssociated] = useState([]);
  const [associationLoading, setAssociationLoading] = useState(false);
  const hasSelectedProduct = products.some((product) => String(product.id) === String(selectedProductId));
  const effectiveProductId = hasSelectedProduct ? selectedProductId : (products[0]?.id || "");
  const selectedProduct = products.find((product) => String(product.id) === String(effectiveProductId));

  useEffect(() => {
    let active = true;
    if (!effectiveProductId) return () => { active = false; };
    api.getProductSuppliers(effectiveProductId).then((items) => { if (active) setAssociated(items); }).catch((error) => { if (active) onToast(getErrorMessage(error), "error"); }).finally(() => { if (active) setAssociationLoading(false); });
    return () => { active = false; };
  }, [effectiveProductId, onToast]);

  const availableSuppliers = suppliers.filter((supplier) => !associated.some((item) => item.id === supplier.id));

  async function associate() {
    if (!effectiveProductId || !selectedSupplierId) return;
    setAssociationLoading(true);
    try { const response = await api.associateSupplier(effectiveProductId, selectedSupplierId); setSelectedSupplierId(""); setAssociated(await api.getProductSuppliers(effectiveProductId)); onToast(response.message, "success"); } catch (error) { onToast(getErrorMessage(error), "error"); } finally { setAssociationLoading(false); }
  }

  function askRemove(supplier) {
    onAskConfirm({ title: "Desassociar fornecedor?", description: `Você está removendo ${supplier.companyName} deste produto.`, confirmLabel: "Desassociar", onConfirm: async () => { try { const response = await api.removeSupplierAssociation(effectiveProductId, supplier.id); setAssociated(await api.getProductSuppliers(effectiveProductId)); onToast(response.message, "success"); } catch (error) { onToast(getErrorMessage(error), "error"); } } });
  }

  return <div className="page-stack"><PageTitle description="Conecte cada produto aos parceiros que o fornecem." eyebrow="Relacionamentos" title="Associações" /><div className="association-layout"><section className="panel association-product"><div className="panel-heading"><div><span className="eyebrow">Etapa 01</span><h2>Escolha um produto</h2></div></div>{loading ? <div className="association-loading"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div> : products.length ? <><div className="select-wrap large-select"><select aria-label="Selecionar produto" onChange={(event) => { setSelectedProductId(event.target.value); setSelectedSupplierId(""); }} value={selectedProductId}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><Icon name="chevronDown" size={17} /></div>{selectedProduct && <div className="selected-product"><span className="mini-product-icon"><Icon name="box" size={17} /></span><div><strong>{selectedProduct.name}</strong><span>{selectedProduct.barcode || "Sem código de barras"}</span></div><StockBadge quantity={selectedProduct.stockQuantity} /></div>}</> : <EmptyState description="Cadastre um produto antes de criar associações." icon="box" title="Nenhum produto disponível" />}</section><section className="panel association-manage"><div className="panel-heading"><div><span className="eyebrow">Etapa 02</span><h2>Gerenciar fornecedores</h2></div></div>{products.length && suppliers.length ? <><div className="associate-form"><label htmlFor="supplier-select">Fornecedor disponível</label><div className="associate-controls"><div className="select-wrap"><select id="supplier-select" onChange={(event) => setSelectedSupplierId(event.target.value)} value={selectedSupplierId}><option value="">Selecione um fornecedor</option>{availableSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.companyName}</option>)}</select><Icon name="chevronDown" size={16} /></div><Button disabled={!selectedSupplierId || associationLoading} icon="link" onClick={associate}>{associationLoading ? "Salvando..." : "Associar fornecedor"}</Button></div></div><div className="association-divider"><span>Fornecedores associados</span><span>{associated.length} {associated.length === 1 ? "vínculo" : "vínculos"}</span></div>{associationLoading && !associated.length ? <LoadingRows columns={2} /> : associated.length ? <div className="association-list">{associated.map((supplier) => <div className="association-row" key={supplier.id}><span className="supplier-avatar"><Icon name="truck" size={16} /></span><div><strong>{supplier.companyName}</strong><small>{supplier.cnpj} · {supplier.primaryContact}</small></div><button className="association-remove" onClick={() => askRemove(supplier)} type="button">Desassociar</button></div>)}</div> : <div className="association-empty"><Icon name="link" size={22} /><p>Este produto ainda não possui fornecedores vinculados.</p></div>}</> : <EmptyState description={products.length ? "Cadastre um fornecedor para criar vínculos." : "Cadastre produtos e fornecedores para criar vínculos."} icon="link" title="Dados insuficientes" />}</section></div></div>;
}

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState("");
  const [toast, setToast] = useState(null);
  const [productModal, setProductModal] = useState(null);
  const [supplierModal, setSupplierModal] = useState(null);
  const [productDetail, setProductDetail] = useState(null);
  const [supplierDetail, setSupplierDetail] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try { const [productList, supplierList] = await Promise.all([api.getProducts(), api.getSuppliers()]); setProducts(productList); setSuppliers(supplierList); setGlobalError(""); } catch (error) { setGlobalError(getErrorMessage(error)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { queueMicrotask(refreshData); }, [refreshData]);

  const showToast = useCallback((message, type = "success") => { setToast({ message, type }); window.setTimeout(() => setToast(null), 4500); }, []);
  function navigate(page) { setActivePage(page); setMobileMenu(false); }
  async function saveCompleted(message) { setProductModal(null); setSupplierModal(null); await refreshData(); showToast(message); }
  function askDeleteProduct(product) { setConfirmState({ title: "Excluir produto?", description: `A exclusão de ${product.name} também remove seus vínculos com fornecedores.`, confirmLabel: "Excluir produto", onConfirm: async () => { try { const response = await api.deleteProduct(product.id); setConfirmState(null); await refreshData(); showToast(response.message); } catch (error) { setConfirmState(null); showToast(getErrorMessage(error), "error"); } } }); }
  function askDeleteSupplier(supplier) { setConfirmState({ title: "Excluir fornecedor?", description: `A exclusão de ${supplier.companyName} remove seus vínculos com produtos.`, confirmLabel: "Excluir fornecedor", onConfirm: async () => { try { const response = await api.deleteSupplier(supplier.id); setConfirmState(null); await refreshData(); showToast(response.message); } catch (error) { setConfirmState(null); showToast(getErrorMessage(error), "error"); } } }); }
  async function viewProduct(product) { try { setProductDetail(await api.getProduct(product.id)); } catch (error) { showToast(getErrorMessage(error), "error"); } }
  async function viewSupplier(supplier) { try { setSupplierDetail(await api.getSupplier(supplier.id)); } catch (error) { showToast(getErrorMessage(error), "error"); } }

  const pageInfo = navItems.find((item) => item.id === activePage) || navItems[0];
  const pageContent = { dashboard: <DashboardPage onNavigate={navigate} products={products} suppliers={suppliers} />, products: <ProductsPage loading={loading} onDelete={askDeleteProduct} onEdit={(product) => setProductModal(product)} onNew={() => setProductModal({})} onView={viewProduct} products={products} />, suppliers: <SuppliersPage loading={loading} onDelete={askDeleteSupplier} onEdit={(supplier) => setSupplierModal(supplier)} onNew={() => setSupplierModal({})} onView={viewSupplier} suppliers={suppliers} />, associations: <AssociationsPage loading={loading} onAskConfirm={setConfirmState} onToast={showToast} products={products} suppliers={suppliers} /> }[activePage];

  return <div className="app-shell flex min-h-screen bg-[#f6f7fb]"><aside className={`sidebar fixed flex min-h-screen w-64 flex-col bg-[#11172d] ${mobileMenu ? "sidebar-open" : ""}`}><div className="brand"><span className="brand-mark"><Icon name="box" size={20} /></span><span><strong>Controle de Estoque</strong></span></div><nav className="main-nav flex-1"><span className="nav-label">Menu principal</span>{navItems.map((item) => <button className={activePage === item.id ? "nav-item active" : "nav-item"} key={item.id} onClick={() => navigate(item.id)} type="button"><Icon name={item.icon} size={18} /><span>{item.label}</span></button>)}</nav></aside>{mobileMenu && <button aria-label="Fechar menu" className="sidebar-overlay" onClick={() => setMobileMenu(false)} type="button" />}<main className="main-content min-w-0 flex-1"><header className="topbar"><button aria-label="Abrir menu" className="mobile-menu-button icon-button" onClick={() => setMobileMenu(true)} type="button"><Icon name="menu" /></button><div className="breadcrumb"><span>Controle de Estoque</span><Icon name="chevronRight" size={14} /><strong>{pageInfo.label}</strong></div></header><div className="content-wrap mx-auto w-full max-w-[1440px]">{globalError && <div className="api-banner"><Icon name="warning" size={17} /><div><strong>Não foi possível carregar os dados</strong><span>{globalError}</span></div><button onClick={refreshData} type="button">Tentar novamente</button></div>}{pageContent}</div></main>{productModal && <ProductFormModal key={productModal.id || "new-product"} onClose={() => setProductModal(null)} onSaved={saveCompleted} product={productModal.id ? productModal : null} />}{supplierModal && <SupplierFormModal key={supplierModal.id || "new-supplier"} onClose={() => setSupplierModal(null)} onSaved={saveCompleted} supplier={supplierModal.id ? supplierModal : null} />}{productDetail && <ProductDetailModal onClose={() => setProductDetail(null)} product={productDetail} />}{supplierDetail && <SupplierDetailModal onClose={() => setSupplierDetail(null)} supplier={supplierDetail} />}{confirmState && <ConfirmModal confirmLabel={confirmState.confirmLabel} description={confirmState.description} onClose={() => setConfirmState(null)} onConfirm={confirmState.onConfirm} title={confirmState.title} />}<Toast toast={toast} /></div>;
}

export default App;
