import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Search, Printer, RefreshCcw, Package, ChevronDown
} from 'lucide-react';
import { NairaIcon } from '../components/NairaIcon';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';
import { formatDateStandard } from '../utils/date';
import { StatCard } from '../components/StatCard';

export const Inventory: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { notify } = useNotification();
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || '');
  const [items, setItems] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: activeCategory,
    stock: 0,
    price: 0,
    cost_price: 0,
    reorder_level: 5,
    expiry_date: '',
    batch_number: ''
  });

  const loadData = async () => {
    try {
      const cats = await api.getInventoryCategories();
      setCategories(cats);
      if (cats.length > 0 && !activeCategory) {
        setActiveCategory(cats[0].name);
      }
    } catch (e) { notify('error', 'Failed to load categories'); }
  };

  const loadInventory = () => {
    if (!activeCategory) return;
    setLoading(true);
    api.getInventory(activeCategory)
      .then(setItems)
      .catch(() => notify('error', 'Failed to load inventory'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    api.getInventory().then(setAllItems);
  }, []);

  useEffect(() => { loadInventory(); }, [activeCategory]);

  const totalValue = allItems.reduce((sum, item) => sum + (item.stock * (item.price || 0)), 0);

  const filteredItems = items.filter(item => 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.id?.toString().includes(searchQuery)
  );

  const handleOpenModal = (item: any = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category,
        stock: item.stock,
        price: item.price || 0,
        cost_price: item.cost_price || 0,
        reorder_level: item.reorder_level || 5,
        expiry_date: item.expiry_date ? item.expiry_date.split('T')[0] : '',
        batch_number: item.batch_number || ''
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        category: activeCategory || categories[0]?.name || '',
        stock: 0,
        price: 0,
        cost_price: 0,
        reorder_level: 5,
        expiry_date: '',
        batch_number: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        // Update logic (API might need a specific update method, or create with ID)
        await api.createInventoryItem({ ...formData, id: editingItem.id });
        notify('success', 'Inventory item updated');
      } else {
        await api.createInventoryItem(formData);
        notify('success', 'New item added to inventory');
      }
      setIsModalOpen(false);
      loadInventory();
      api.getInventory().then(setAllItems);
    } catch (error: any) {
      notify('error', error.message || 'Failed to save item');
    }
  };

  return (
    <div className="leh-page-container">
      {/* Page Header */}
      <header className="leh-page-header">
        <div className="leh-header-left">
          <div className="leh-header-icon-box">
            <Package size={28} />
          </div>
          <div className="leh-header-text">
            <h1 className="leh-page-title">Inventory Management</h1>
            <p className="leh-page-subtitle">Strategic asset oversight and medical stock synchronization.</p>
          </div>
        </div>

        <div className="leh-header-actions">
          <div className="leh-search-box" style={{ width: '320px' }}>
            <Search size={18} className="leh-search-icon" />
            <input
              placeholder="Search inventory items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              spellCheck={false}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="leh-search-clear" type="button">
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>&times;</span>
              </button>
            )}
          </div>
          <button 
            className="leh-btn-outline" 
            style={{ border: 'none', height: '48px', width: '48px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={fetchData}
            data-tooltip="Sync inventory stock levels"
            aria-label="Refresh stock"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="leh-btn-primary" onClick={() => handleOpenModal()} data-tooltip="Register new asset record">
            <Plus size={20} />
            <span>ADD NEW ITEM</span>
          </button>
        </div>
      </header>

      {/* Stats Ribbon */}
      <div className="leh-stat-grid" style={{ marginBottom: '40px' }}>
        <StatCard 
          title="TOTAL PRODUCTS" 
          value={allItems.length} 
          icon={Package} 
          colorClass="blue" 
          trend="+2.5%" 
          subtitle="from last month"
        />
        <StatCard 
          title="LOW STOCK ITEMS" 
          value={allItems.filter(i => i.stock <= i.reorder_level).length} 
          icon={Package} 
          colorClass="amber" 
          trend={allItems.filter(i => i.stock <= i.reorder_level).length > 0 ? "+12%" : "0%"} 
          subtitle="requiring attention"
        />
        <StatCard 
          title="TOTAL ASSET VALUE" 
          value={`₦${(totalValue / 1000000).toFixed(1)}M`} 
          icon={NairaIcon} 
          colorClass="green" 
          trend="+5.2%" 
          subtitle="current valuation"
        />
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--leh-border-light)', paddingBottom: '12px' }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.name)}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              background: activeCategory === cat.name ? 'var(--leh-primary-light)' : 'transparent',
              color: activeCategory === cat.name ? 'var(--leh-primary)' : 'var(--leh-text-muted)',
              fontSize: '13px',
              fontWeight: '800',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {cat.name.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Main Content: Inventory Table */}
      <div className="leh-table-wrapper">
        <table className="leh-table">
          <thead>
            <tr>
              <th>PRODUCT IDENTIFIER</th>
              <th>ITEM DESCRIPTION</th>
              <th>CATEGORY</th>
              <th>STOCK LEVEL</th>
              <th>UNIT PRICE</th>
              <th>EXPIRY DATE</th>
              <th style={{ textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '80px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <RefreshCcw size={40} className="animate-spin text-blue-500" />
                    <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--leh-text-muted)', textTransform: 'uppercase' }}>
                      Synchronizing stock records...
                    </p>
                  </div>
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '80px' }}>
                  <div style={{ opacity: 0.3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <Package size={64} />
                    <p style={{ fontWeight: '800', textTransform: 'uppercase', fontSize: '14px' }}>No inventory matches discovered</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id} className="leh-table-row">
                  <td>
                    <span style={{ fontWeight: '900', color: 'var(--leh-text-muted)', background: 'var(--leh-bg-light)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', border: '1px solid var(--leh-border-light)' }}>
                      {item.id}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '700', color: 'var(--leh-text-dark)' }}>{item.name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--leh-text-light)' }}>Batch: {item.batch_number || 'N/A'}</span>
                    </div>
                  </td>
                  <td>
                    <span className="leh-status-badge" style={{ fontSize: '10px' }}>{item.category}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                       <span style={{ 
                         fontWeight: '900', 
                         color: item.stock <= item.reorder_level ? 'var(--leh-red)' : 'var(--leh-text-dark)',
                         fontSize: '15px'
                       }}>
                         {item.stock}
                       </span>
                       {item.stock <= item.reorder_level && (
                         <span className="leh-status-badge red" style={{ fontSize: '9px', padding: '1px 6px' }}>LOW</span>
                       )}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: '700', color: 'var(--leh-text-grey)' }}>₦{item.price?.toLocaleString()}</span>
                  </td>
                  <td>
                    <div className="leh-date-display">
                      <span className="leh-date-main" style={{ color: item.expiry_date && new Date(item.expiry_date) < new Date() ? 'var(--leh-red)' : 'inherit' }}>
                        {item.expiry_date ? formatDateStandard(item.expiry_date) : 'No Expiry'}
                      </span>
                      {item.expiry_date && (
                        <span className="leh-date-sub">
                          {new Date(item.expiry_date) < new Date() ? 'EXPIRED' : 'ACTIVE BATCH'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button 
                        className="leh-btn-primary" 
                        style={{ height: '36px', padding: '0 12px' }}
                        onClick={() => handleOpenModal(item)}
                        data-tooltip="Modify asset details"
                        aria-label="Edit item"
                      >
                        <Edit3 size={14} style={{ marginRight: '6px' }} />
                        <span>UPDATE</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Inventory Modal */}
      {isModalOpen && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-content" style={{ maxWidth: '680px' }}>
            <div className="leh-modal-header">
               <div className="leh-modal-title">
                  <Package size={24} style={{ color: 'var(--leh-primary)' }} />
                  <span>{editingItem ? 'Update Asset Record' : 'Register New Asset'}</span>
               </div>
               <button className="leh-modal-close" onClick={() => setIsModalOpen(false)}>
                  <X size={20} />
               </button>
            </div>

            <div className="leh-modal-body" style={{ padding: '32px' }}>
              <form onSubmit={handleSubmit}>
                <div className="leh-form-section" style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <Box size={16} style={{ color: 'var(--leh-primary)' }} />
                    <h4 style={{ fontSize: '13px', fontWeight: '900', color: 'var(--leh-text-dark)', margin: 0, letterSpacing: '0.05em' }}>ASSET CLASSIFICATION</h4>
                  </div>
                  
                  <div className="leh-form-grid">
                    <div className="leh-form-group full-width">
                      <label className="leh-label">PRODUCT SPECIFICATION NAME</label>
                      <input
                        className="leh-input"
                        required
                        placeholder="e.g. Paracetamol 500mg Tablets"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">CLINICAL CATEGORY</label>
                      <select
                        className="leh-select"
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                      >
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">BATCH REFERENCE</label>
                      <input
                        className="leh-input"
                        placeholder="e.g. BATCH-2026-X"
                        value={formData.batch_number}
                        onChange={e => setFormData({...formData, batch_number: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="leh-form-section" style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <Clock size={16} style={{ color: 'var(--leh-amber)' }} />
                    <h4 style={{ fontSize: '13px', fontWeight: '900', color: 'var(--leh-text-dark)', margin: 0, letterSpacing: '0.05em' }}>STOCK CONTROL & THRESHOLDS</h4>
                  </div>
                  <div className="leh-form-grid">
                    <div className="leh-form-group">
                      <label className="leh-label">AVAILABLE STOCK</label>
                      <input
                        type="number"
                        className="leh-input"
                        required
                        value={formData.stock}
                        onChange={e => setFormData({...formData, stock: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">CRITICAL REORDER LEVEL</label>
                      <input
                        type="number"
                        className="leh-input"
                        required
                        value={formData.reorder_level}
                        onChange={e => setFormData({...formData, reorder_level: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                <div className="leh-form-section" style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <CreditCard size={16} style={{ color: 'var(--leh-green)' }} />
                    <h4 style={{ fontSize: '13px', fontWeight: '900', color: 'var(--leh-text-dark)', margin: 0, letterSpacing: '0.05em' }}>VALUATION & LIFECYCLE</h4>
                  </div>
                  <div className="leh-form-grid">
                    <div className="leh-form-group">
                      <label className="leh-label">ACQUISITION COST (₦)</label>
                      <input
                        type="number"
                        className="leh-input"
                        required
                        value={formData.cost_price}
                        onChange={e => setFormData({...formData, cost_price: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">RETAIL PRICE (₦)</label>
                      <input
                        type="number"
                        className="leh-input"
                        required
                        value={formData.price}
                        onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div className="leh-form-group full-width">
                      <label className="leh-label">ASSET EXPIRY DATE</label>
                      <input
                        type="date"
                        className="leh-date-input"
                        style={{ width: '100%' }}
                        value={formData.expiry_date}
                        onChange={e => setFormData({...formData, expiry_date: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="leh-modal-footer" style={{ padding: '0', background: 'transparent', border: 'none', marginTop: '40px', gap: '16px' }}>
                  <button type="button" className="leh-btn-outline" onClick={() => setIsModalOpen(false)} style={{ height: '56px', flex: 1 }}>CANCEL</button>
                  <button type="submit" className="leh-btn-primary" style={{ height: '56px', flex: 2 }}>
                    {editingItem ? 'UPDATE ASSET RECORDS' : 'FINALIZE REGISTRATION'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
