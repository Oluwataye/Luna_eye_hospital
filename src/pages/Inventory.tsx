import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, Search, RefreshCcw, Package, Edit3, X, Box, Clock, CreditCard,
  Trash2, TrendingUp, AlertTriangle
} from 'lucide-react';
import { NairaIcon } from '../components/NairaIcon';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';
import { formatDateStandard } from '../utils/date';
import { StatCard } from '../components/StatCard';
import { useAuth } from '../context/AuthContext';

export const Inventory: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { notify } = useNotification();
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || '');
  const [items, setItems] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'details' | 'stock'>('details');
  const [stockAdjust, setStockAdjust] = useState({ type: 'IN', quantity: 0, reason: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [newCategoryTemplate, setNewCategoryTemplate] = useState('NONE');

  const getCategoryTemplate = (categoryName: string) => {
    if (!categoryName) return 'NONE';
    const cat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    if (cat?.attribute_template) return cat.attribute_template.toUpperCase();
    
    // Fallback based on name for built-in categories
    const upperName = categoryName.toUpperCase();
    if (upperName === 'DRUGS') return 'DRUGS';
    if (upperName === 'TEST') return 'TEST';
    if (upperName === 'LENSES') return 'LENSES';
    if (upperName === 'FRAMES') return 'FRAMES';
    if (upperName === 'LABORATORY') return 'LABORATORY';
    
    return 'NONE';
  };

  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: activeCategory,
    stock: 0,
    price: 0,
    cost_price: 0,
    reorder_level: 5,
    expiry_date: '',
    batch_number: '',
    supplier: '',
    attributes: {} as any
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

  const setAttribute = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      attributes: {
        ...(prev.attributes || {}),
        [key]: value
      }
    }));
  };

  const renderCategorySpecificFields = () => {
    const template = getCategoryTemplate(formData.category);
    const attrs = formData.attributes || {};

    if (template === 'FRAMES') {
      return (
        <div className="leh-form-section" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Box size={16} style={{ color: 'var(--leh-primary)' }} />
            <h4 style={{ fontSize: '13px', fontWeight: '900', color: 'var(--leh-text-dark)', margin: 0, letterSpacing: '0.05em' }}>OPTICAL FRAME SPECIFICS</h4>
          </div>
          <div className="leh-form-grid">
            <div className="leh-form-group">
              <label className="leh-label">FRAME TYPE</label>
              <select
                className="leh-select"
                value={attrs.frame_type || ''}
                onChange={e => setAttribute('frame_type', e.target.value)}
              >
                <option value="">Select type...</option>
                <option value="Full-rim">Full-rim</option>
                <option value="Semi-rimless">Semi-rimless</option>
                <option value="Rimless">Rimless</option>
              </select>
            </div>
            <div className="leh-form-group">
              <label className="leh-label">FRAME MATERIAL</label>
              <select
                className="leh-select"
                value={attrs.material || ''}
                onChange={e => setAttribute('material', e.target.value)}
              >
                <option value="">Select material...</option>
                <option value="Acetate">Acetate</option>
                <option value="Metal">Metal</option>
                <option value="Titanium">Titanium</option>
                <option value="TR90">TR90 (Plastic)</option>
                <option value="Carbon Fiber">Carbon Fiber</option>
              </select>
            </div>
            <div className="leh-form-group">
              <label className="leh-label">FRAME SHAPE</label>
              <select
                className="leh-select"
                value={attrs.shape || ''}
                onChange={e => setAttribute('shape', e.target.value)}
              >
                <option value="">Select shape...</option>
                <option value="Rectangular">Rectangular</option>
                <option value="Round">Round</option>
                <option value="Square">Square</option>
                <option value="Aviator">Aviator</option>
                <option value="Cat-eye">Cat-eye</option>
                <option value="Oval">Oval</option>
              </select>
            </div>
            <div className="leh-form-group">
              <label className="leh-label">FRAME SIZE (e.g. 52-18-140)</label>
              <input
                className="leh-input"
                placeholder="52-18-140"
                value={attrs.frame_size || ''}
                onChange={e => setAttribute('frame_size', e.target.value)}
              />
            </div>
            <div className="leh-form-group full-width">
              <label className="leh-label">FRAME COLOR</label>
              <input
                className="leh-input"
                placeholder="e.g. Tortoise Shell, Matte Black"
                value={attrs.color || ''}
                onChange={e => setAttribute('color', e.target.value)}
              />
            </div>
          </div>
        </div>
      );
    }

    if (template === 'LENSES') {
      return (
        <div className="leh-form-section" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Box size={16} style={{ color: 'var(--leh-primary)' }} />
            <h4 style={{ fontSize: '13px', fontWeight: '900', color: 'var(--leh-text-dark)', margin: 0, letterSpacing: '0.05em' }}>OPTICAL LENS SPECIFICS</h4>
          </div>
          <div className="leh-form-grid">
            <div className="leh-form-group">
              <label className="leh-label">LENS TYPE</label>
              <select
                className="leh-select"
                value={attrs.lens_type || ''}
                onChange={e => setAttribute('lens_type', e.target.value)}
              >
                <option value="">Select type...</option>
                <option value="Single Vision">Single Vision</option>
                <option value="Bifocal">Bifocal</option>
                <option value="Progressive">Progressive</option>
              </select>
            </div>
            <div className="leh-form-group">
              <label className="leh-label">MATERIAL / INDEX</label>
              <select
                className="leh-select"
                value={attrs.material_index || ''}
                onChange={e => setAttribute('material_index', e.target.value)}
              >
                <option value="">Select material/index...</option>
                <option value="CR-39 (1.50)">CR-39 (1.50)</option>
                <option value="Mid-Index (1.56)">Mid-Index (1.56)</option>
                <option value="Polycarbonate (1.59)">Polycarbonate (1.59)</option>
                <option value="High-Index (1.61)">High-Index (1.61)</option>
                <option value="Ultra High-Index (1.67)">Ultra High-Index (1.67)</option>
                <option value="Ultra High-Index (1.74)">Ultra High-Index (1.74)</option>
              </select>
            </div>
            <div className="leh-form-group">
              <label className="leh-label">COATING</label>
              <select
                className="leh-select"
                value={attrs.coating || ''}
                onChange={e => setAttribute('coating', e.target.value)}
              >
                <option value="">Select coating...</option>
                <option value="Anti-Glare (AR)">Anti-Glare (AR)</option>
                <option value="Blue Light Filter">Blue Light Filter</option>
                <option value="Photochromic (Transitions)">Photochromic (Transitions)</option>
                <option value="Polarized">Polarized</option>
                <option value="Scratch Resistant">Scratch Resistant</option>
                <option value="None">None</option>
              </select>
            </div>
            <div className="leh-form-group">
              <label className="leh-label">SPHERE POWER RANGE</label>
              <input
                className="leh-input"
                placeholder="e.g. Plano to +6.00"
                value={attrs.sphere_range || ''}
                onChange={e => setAttribute('sphere_range', e.target.value)}
              />
            </div>
            <div className="leh-form-group full-width">
              <label className="leh-label">CYLINDER POWER RANGE</label>
              <input
                className="leh-input"
                placeholder="e.g. 0.00 to -2.00"
                value={attrs.cylinder_range || ''}
                onChange={e => setAttribute('cylinder_range', e.target.value)}
              />
            </div>
          </div>
        </div>
      );
    }

    if (template === 'DRUGS') {
      return (
        <div className="leh-form-section" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Box size={16} style={{ color: 'var(--leh-primary)' }} />
            <h4 style={{ fontSize: '13px', fontWeight: '900', color: 'var(--leh-text-dark)', margin: 0, letterSpacing: '0.05em' }}>DRUG SPECIFICS</h4>
          </div>
          <div className="leh-form-grid">
            <div className="leh-form-group">
              <label className="leh-label">DOSAGE FORM</label>
              <select
                className="leh-select"
                value={attrs.dosage_form || ''}
                onChange={e => setAttribute('dosage_form', e.target.value)}
              >
                <option value="">Select form...</option>
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Drop">Drop (Eye/Ear)</option>
                <option value="Syrup">Syrup</option>
                <option value="Ointment">Ointment</option>
                <option value="Injection">Injection</option>
              </select>
            </div>
            <div className="leh-form-group">
              <label className="leh-label">STRENGTH</label>
              <input
                className="leh-input"
                placeholder="e.g. 500mg, 0.5%, 5ml"
                value={attrs.strength || ''}
                onChange={e => setAttribute('strength', e.target.value)}
              />
            </div>
            <div className="leh-form-group full-width">
              <label className="leh-label">ACTIVE INGREDIENT</label>
              <input
                className="leh-input"
                placeholder="e.g. Paracetamol, Tobramycin"
                value={attrs.active_ingredient || ''}
                onChange={e => setAttribute('active_ingredient', e.target.value)}
              />
            </div>
          </div>
        </div>
      );
    }

    if (template === 'TEST') {
      return (
        <div className="leh-form-section" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Box size={16} style={{ color: 'var(--leh-primary)' }} />
            <h4 style={{ fontSize: '13px', fontWeight: '900', color: 'var(--leh-text-dark)', margin: 0, letterSpacing: '0.05em' }}>DIAGNOSTIC TEST SPECIFICS</h4>
          </div>
          <div className="leh-form-grid">
            <div className="leh-form-group">
              <label className="leh-label">TEST TYPE / PROCEDURAL CLASSIFICATION</label>
              <select
                className="leh-select"
                value={attrs.test_type || ''}
                onChange={e => setAttribute('test_type', e.target.value)}
              >
                <option value="">Select type...</option>
                <option value="Refraction">Refraction Test</option>
                <option value="Tonometry (IOP)">Tonometry (IOP)</option>
                <option value="Visual Field (Perimetry)">Visual Field (Perimetry)</option>
                <option value="Fundus Photography">Fundus Photography</option>
                <option value="Optical Coherence Tomography (OCT)">Optical Coherence Tomography (OCT)</option>
                <option value="Slit Lamp Exam">Slit Lamp Exam</option>
                <option value="Pachymetry">Pachymetry</option>
                <option value="Dry Eye Assessment">Dry Eye Assessment</option>
              </select>
            </div>
            <div className="leh-form-group">
              <label className="leh-label">EXPECTED DURATION</label>
              <select
                className="leh-select"
                value={attrs.duration || ''}
                onChange={e => setAttribute('duration', e.target.value)}
              >
                <option value="">Select duration...</option>
                <option value="5 mins">5 mins</option>
                <option value="10 mins">10 mins</option>
                <option value="15 mins">15 mins</option>
                <option value="20 mins">20 mins</option>
                <option value="30 mins">30 mins</option>
                <option value="45 mins">45 mins</option>
              </select>
            </div>
            <div className="leh-form-group">
              <label className="leh-label">REQUIRED EQUIPMENT / INSTRUMENT</label>
              <input
                className="leh-input"
                placeholder="e.g. Autorefractor, Tonometer, OCT Scanner"
                value={attrs.equipment || ''}
                onChange={e => setAttribute('equipment', e.target.value)}
              />
            </div>
            <div className="leh-form-group">
              <label className="leh-label">CLINICAL LOCATION</label>
              <select
                className="leh-select"
                value={attrs.location || ''}
                onChange={e => setAttribute('location', e.target.value)}
              >
                <option value="">Select location...</option>
                <option value="Triage Room">Triage Room</option>
                <option value="Consulting Room">Consulting Room</option>
                <option value="Diagnostic Suite">Diagnostic Suite</option>
                <option value="Main Clinic">Main Clinic Area</option>
              </select>
            </div>
          </div>
        </div>
      );
    }

    if (template === 'LABORATORY') {
      return (
        <div className="leh-form-section" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Box size={16} style={{ color: 'var(--leh-primary)' }} />
            <h4 style={{ fontSize: '13px', fontWeight: '900', color: 'var(--leh-text-dark)', margin: 0, letterSpacing: '0.05em' }}>LABORATORY SPECIFICS</h4>
          </div>
          <div className="leh-form-grid">
            <div className="leh-form-group">
              <label className="leh-label">SUB-TYPE</label>
              <select
                className="leh-select"
                value={attrs.lab_type || ''}
                onChange={e => setAttribute('lab_type', e.target.value)}
              >
                <option value="">Select type...</option>
                <option value="Test">Diagnostic Test (Billable)</option>
                <option value="Reagent">Chemical Reagent</option>
                <option value="Consumable">Lab Consumable</option>
                <option value="Equipment">Lab Equipment</option>
              </select>
            </div>
            {attrs.lab_type === 'Test' && (
              <>
                <div className="leh-form-group">
                  <label className="leh-label">BUILT-IN TEMPLATE</label>
                  <select
                    className="leh-select"
                    value={attrs.test_template || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setAttribute('test_template', val);
                      if (val === 'Fasting Blood Sugar') {
                        setAttribute('unit', 'mg/dL');
                        setAttribute('reference_range', '70 - 100');
                      } else if (val === 'Full Blood Count') {
                        setAttribute('unit', 'cells/mcL');
                        setAttribute('reference_range', '4500 - 11000');
                      } else if (val === 'Urinalysis') {
                        setAttribute('unit', 'pH / SG');
                        setAttribute('reference_range', 'pH 4.6-8.0, SG 1.005-1.030');
                      }
                    }}
                  >
                    <option value="">Custom...</option>
                    <option value="Fasting Blood Sugar">Fasting Blood Sugar</option>
                    <option value="Full Blood Count">Full Blood Count (WBC)</option>
                    <option value="Urinalysis">Urinalysis</option>
                  </select>
                </div>
                <div className="leh-form-group">
                  <label className="leh-label">UNIT OF MEASUREMENT</label>
                  <input
                    className="leh-input"
                    placeholder="e.g. mg/dL, mmol/L"
                    value={attrs.unit || ''}
                    onChange={e => setAttribute('unit', e.target.value)}
                  />
                </div>
                <div className="leh-form-group full-width">
                  <label className="leh-label">REFERENCE RANGE</label>
                  <input
                    className="leh-input"
                    placeholder="e.g. 70 - 100"
                    value={attrs.reference_range || ''}
                    onChange={e => setAttribute('reference_range', e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

  };

  const renderItemAttributesSummary = (item: any) => {
    if (!item.attributes) return null;
    let attrs: any = {};
    try {
      attrs = typeof item.attributes === 'string' ? JSON.parse(item.attributes) : item.attributes;
    } catch (e) {
      return null;
    }

    if (!attrs || Object.keys(attrs).length === 0) return null;

    const template = getCategoryTemplate(item.category);
    if (template === 'FRAMES') {
      const parts = [
        attrs.material,
        attrs.frame_type,
        attrs.shape,
        attrs.frame_size ? `Size: ${attrs.frame_size}` : null,
        attrs.color ? `Color: ${attrs.color}` : null
      ].filter(Boolean);
      if (parts.length === 0) return null;
      return (
        <span style={{ fontSize: '10px', color: 'var(--leh-primary)', fontWeight: '700', marginTop: '4px', letterSpacing: '0.02em' }}>
          {parts.join(' • ').toUpperCase()}
        </span>
      );
    }

    if (template === 'LENSES') {
      const parts = [
        attrs.lens_type,
        attrs.material_index,
        attrs.coating,
        attrs.sphere_range ? `Sph: ${attrs.sphere_range}` : null,
        attrs.cylinder_range ? `Cyl: ${attrs.cylinder_range}` : null
      ].filter(Boolean);
      if (parts.length === 0) return null;
      return (
        <span style={{ fontSize: '10px', color: 'var(--leh-primary)', fontWeight: '700', marginTop: '4px', letterSpacing: '0.02em' }}>
          {parts.join(' • ').toUpperCase()}
        </span>
      );
    }

    if (template === 'DRUGS') {
      const parts = [
        attrs.dosage_form,
        attrs.strength,
        attrs.active_ingredient ? `Active: ${attrs.active_ingredient}` : null
      ].filter(Boolean);
      if (parts.length === 0) return null;
      return (
        <span style={{ fontSize: '10px', color: 'var(--leh-amber)', fontWeight: '700', marginTop: '4px', letterSpacing: '0.02em' }}>
          {parts.join(' • ').toUpperCase()}
        </span>
      );
    }

    if (template === 'TEST') {
      const parts = [
        attrs.test_type ? `Type: ${attrs.test_type}` : null,
        attrs.duration ? `Duration: ${attrs.duration}` : null,
        attrs.equipment ? `Equipment: ${attrs.equipment}` : null,
        attrs.location ? `Loc: ${attrs.location}` : null
      ].filter(Boolean);
      if (parts.length === 0) return null;
      return (
        <span style={{ fontSize: '10px', color: 'var(--leh-primary)', fontWeight: '700', marginTop: '4px', letterSpacing: '0.02em' }}>
          {parts.join(' • ').toUpperCase()}
        </span>
      );
    }

    if (template === 'LABORATORY') {
      const parts = [
        attrs.lab_type ? `Type: ${attrs.lab_type}` : null,
        attrs.unit ? `Unit: ${attrs.unit}` : null,
        attrs.reference_range ? `Ref: ${attrs.reference_range}` : null
      ].filter(Boolean);
      if (parts.length === 0) return null;
      return (
        <span style={{ fontSize: '10px', color: 'var(--leh-primary)', fontWeight: '700', marginTop: '4px', letterSpacing: '0.02em' }}>
          {parts.join(' • ').toUpperCase()}
        </span>
      );
    }

    return null;
  };

  const handleOpenModal = (item: any = null) => {
    setModalTab('details');
    setStockAdjust({ type: 'IN', quantity: 0, reason: '' });
    setDeleteConfirm(false);
    if (item) {
      setEditingItem(item);
      let parsedAttrs = {};
      try {
        parsedAttrs = item.attributes ? (typeof item.attributes === 'string' ? JSON.parse(item.attributes) : item.attributes) : {};
      } catch (e) {
        console.error('Failed to parse item attributes:', e);
      }
      setFormData({
        name: item.name,
        category: item.category,
        stock: item.stock,
        price: item.price || 0,
        cost_price: item.cost_price || 0,
        reorder_level: item.reorder_level || 5,
        expiry_date: item.expiry_date ? item.expiry_date.split('T')[0] : '',
        batch_number: item.batch_number || '',
        supplier: item.supplier || '',
        attributes: parsedAttrs
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
        batch_number: '',
        supplier: '',
        attributes: {}
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.updateInventoryItem(editingItem.id, formData);
        notify('success', 'Asset record updated successfully');
      } else {
        await api.createInventoryItem(formData);
        notify('success', 'New asset registered successfully');
      }
      setIsModalOpen(false);
      loadInventory();
      api.getInventory().then(setAllItems);
    } catch (error: any) {
      notify('error', error.message || 'Failed to save item');
    }
  };

  const handleStockAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!stockAdjust.quantity || stockAdjust.quantity <= 0) {
      notify('error', 'Quantity must be greater than zero');
      return;
    }
    if (!stockAdjust.reason.trim()) {
      notify('error', 'A reason is required for stock adjustment');
      return;
    }
    try {
      const change = stockAdjust.type === 'OUT' ? -stockAdjust.quantity : stockAdjust.quantity;
      await api.updateInventoryStock(editingItem.id, {
        quantity_change: change,
        reason: stockAdjust.reason.trim(),
        type: stockAdjust.type,
        performed_by: 'Admin'
      });
      notify('success', `Stock ${stockAdjust.type === 'IN' ? 'added' : 'deducted'}: ${stockAdjust.quantity} units`);
      setIsModalOpen(false);
      loadInventory();
      api.getInventory().then(setAllItems);
    } catch (error: any) {
      notify('error', error.message || 'Stock adjustment failed');
    }
  };

  const handleDeleteItem = async () => {
    if (!editingItem) return;
    try {
      await api.deleteInventoryItem(editingItem.id);
      notify('success', `"${editingItem.name}" removed from inventory`);
      setIsModalOpen(false);
      loadInventory();
      api.getInventory().then(setAllItems);
    } catch (error: any) {
      notify('error', error.message || 'Could not delete item');
      setDeleteConfirm(false);
    }
  };


  const handleAddOrUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      if (editingCategory) {
        await api.updateInventoryCategory(editingCategory.id, {
          name: newCategoryName.trim(),
          description: newCategoryDesc.trim(),
          attribute_template: newCategoryTemplate
        });
        notify('success', 'Category updated successfully');
      } else {
        await api.createInventoryCategory({
          name: newCategoryName.trim(),
          description: newCategoryDesc.trim(),
          attribute_template: newCategoryTemplate
        });
        notify('success', 'Category created successfully');
      }
      setNewCategoryName('');
      setNewCategoryDesc('');
      setNewCategoryTemplate('NONE');
      setEditingCategory(null);
      const cats = await api.getInventoryCategories();
      setCategories(cats);
    } catch (err: any) {
      notify('error', err.message || 'Failed to save category');
    }
  };

  const handleDeleteCategory = async (catId: number, catName: string) => {
    const itemsInCat = allItems.filter(item => item.category?.toLowerCase() === catName.toLowerCase());
    if (itemsInCat.length > 0) {
      notify('error', `Cannot delete: ${itemsInCat.length} item(s) are currently assigned to this category.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the category "${catName}"?`)) {
      return;
    }

    try {
      await api.deleteInventoryCategory(catId);
      notify('success', 'Category deleted successfully');
      const cats = await api.getInventoryCategories();
      setCategories(cats);
      if (activeCategory.toLowerCase() === catName.toLowerCase() && cats.length > 0) {
        setActiveCategory(cats[0].name);
      }
    } catch (err: any) {
      notify('error', err.message || 'Failed to delete category');
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
            onClick={loadInventory}
            data-tooltip="Sync inventory stock levels"
            aria-label="Refresh stock"
          >
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          {isAdmin && (
            <>
              <button 
                className="leh-btn-outline" 
                style={{ height: '48px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px' }}
                onClick={() => {
                  setNewCategoryName('');
                  setNewCategoryDesc('');
                  setEditingCategory(null);
                  setIsCategoryModalOpen(true);
                }}
                data-tooltip="Manage inventory categories"
              >
                <Box size={20} />
                <span>MANAGE CATEGORIES</span>
              </button>
              <button className="leh-btn-primary" onClick={() => handleOpenModal()} data-tooltip="Register new asset record">
                <Plus size={20} />
                <span>ADD NEW ITEM</span>
              </button>
            </>
          )}
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--leh-border-light)', paddingBottom: '12px' }}>
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
                      <span style={{ fontSize: '10px', color: 'var(--leh-text-light)' }}>
                        {getCategoryTemplate(item.category) === 'TEST' ? 'Service/Procedure' : `Batch: ${item.batch_number || 'N/A'}`}
                      </span>
                      {renderItemAttributesSummary(item)}
                    </div>
                  </td>
                  <td>
                    <span className="leh-status-badge" style={{ fontSize: '10px' }}>{item.category}</span>
                  </td>
                  <td>
                    {getCategoryTemplate(item.category) === 'TEST' ? (
                      <span className="leh-status-badge blue" style={{ fontSize: '10px' }}>SERVICE</span>
                    ) : (
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
                    )}
                  </td>
                  <td>
                    <span style={{ fontWeight: '700', color: 'var(--leh-text-grey)' }}>₦{item.price?.toLocaleString()}</span>
                  </td>
                  <td>
                    {getCategoryTemplate(item.category) === 'TEST' ? (
                      <span style={{ color: 'var(--leh-text-light)' }}>—</span>
                    ) : (
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
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      {isAdmin ? (
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
                      ) : (
                        <button 
                          className="leh-btn-outline" 
                          style={{ height: '36px', padding: '0 12px' }}
                          onClick={() => handleOpenModal(item)}
                          data-tooltip="View asset details"
                          aria-label="View item"
                        >
                          <Search size={14} style={{ marginRight: '6px' }} />
                          <span>VIEW</span>
                        </button>
                      )}
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
          <div className="leh-modal-content" style={{ maxWidth: '700px' }}>
            <div className="leh-modal-header">
               <div className="leh-modal-title">
                 <Package size={24} style={{ color: 'var(--leh-primary)' }} />
                 <span>{editingItem ? (isAdmin ? 'Update Asset Record' : 'View Asset Details') : 'Register New Asset'}</span>
               </div>
               <button className="leh-modal-close" onClick={() => setIsModalOpen(false)}>
                  <X size={20} />
               </button>
            </div>

            {/* Tabs — only in edit mode */}
            {editingItem && (
              <div style={{
                display: 'flex', borderBottom: '1px solid var(--leh-border-light)',
                padding: '0 32px', background: 'var(--leh-bg-light)'
              }}>
                {[
                  { key: 'details', label: isAdmin ? 'Edit Details' : 'View Details', icon: <Edit3 size={14} /> },
                  ...(isAdmin && getCategoryTemplate(formData.category) !== 'TEST'
                    ? [{ key: 'stock', label: 'Stock Adjustment', icon: <TrendingUp size={14} /> }]
                    : [])
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => { setModalTab(tab.key as any); setDeleteConfirm(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '14px 18px', fontSize: '12px', fontWeight: '800',
                      letterSpacing: '0.05em', border: 'none', background: 'transparent',
                      cursor: 'pointer', borderBottom: modalTab === tab.key
                        ? '2px solid var(--leh-primary)' : '2px solid transparent',
                      color: modalTab === tab.key ? 'var(--leh-primary)' : 'var(--leh-text-muted)',
                      transition: 'all 0.15s'
                    }}
                  >
                    {tab.icon}{tab.label.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            <div className="leh-modal-body" style={{ padding: '32px' }}>

              {/* ── DETAILS TAB / CREATE FORM ── */}
              {(modalTab === 'details') && (
                <form onSubmit={handleSubmit}>
                  <fieldset disabled={!isAdmin} style={{ border: 'none', padding: 0, margin: 0 }}>
                    <div className="leh-form-section" style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                      <Box size={16} style={{ color: 'var(--leh-primary)' }} />
                      <h4 style={{ fontSize: '13px', fontWeight: '900', color: 'var(--leh-text-dark)', margin: 0, letterSpacing: '0.05em' }}>
                        {getCategoryTemplate(formData.category) === 'TEST' ? 'SERVICE CLASSIFICATION' : 'ASSET CLASSIFICATION'}
                      </h4>
                    </div>
                    <div className="leh-form-grid">
                      <div className="leh-form-group full-width">
                        <label className="leh-label">
                          {getCategoryTemplate(formData.category) === 'TEST' ? 'SERVICE / PROCEDURE NAME' : 'PRODUCT SPECIFICATION NAME'}
                        </label>
                        <input
                          className="leh-input"
                          required
                          placeholder={getCategoryTemplate(formData.category) === 'TEST' ? 'e.g. Visual Field Analysis (Humphrey)' : 'e.g. Paracetamol 500mg Tablets'}
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                      </div>
                      <div className="leh-form-group" style={{ gridColumn: getCategoryTemplate(formData.category) === 'TEST' ? '1 / -1' : 'auto' }}>
                        <label className="leh-label">CLINICAL CATEGORY</label>
                        <select
                          className="leh-select"
                          value={formData.category}
                          onChange={e => {
                            const newCat = e.target.value;
                            const newTemplate = getCategoryTemplate(newCat);
                            const isService = newTemplate === 'TEST';
                            setFormData(prev => ({
                              ...prev,
                              category: newCat,
                              stock: isService ? 0 : prev.stock,
                              reorder_level: isService ? 0 : prev.reorder_level,
                              cost_price: isService ? 0 : prev.cost_price,
                              batch_number: isService ? '' : prev.batch_number,
                              expiry_date: isService ? '' : prev.expiry_date
                            }));
                          }}
                        >
                          {categories.map(c => <option key={c.id} value={c.name}>{c.name.toUpperCase()}</option>)}
                        </select>
                      </div>
                      {getCategoryTemplate(formData.category) !== 'TEST' && (
                        <div className="leh-form-group">
                          <label className="leh-label">BATCH REFERENCE</label>
                          <input
                            className="leh-input"
                            placeholder="e.g. BATCH-2026-X"
                            value={formData.batch_number}
                            onChange={e => setFormData({...formData, batch_number: e.target.value})}
                          />
                        </div>
                      )}
                      {getCategoryTemplate(formData.category) !== 'TEST' && (
                        <div className="leh-form-group">
                          <label className="leh-label">SUPPLIER / VENDOR</label>
                          <input
                            className="leh-input"
                            placeholder="e.g. PharmaCo Ltd."
                            value={formData.supplier}
                            onChange={e => setFormData({...formData, supplier: e.target.value})}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {renderCategorySpecificFields()}

                  {getCategoryTemplate(formData.category) !== 'TEST' && (
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
                            onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
                          />
                        </div>
                        <div className="leh-form-group">
                          <label className="leh-label">CRITICAL REORDER LEVEL</label>
                          <input
                            type="number"
                            className="leh-input"
                            required
                            value={formData.reorder_level}
                            onChange={e => setFormData({...formData, reorder_level: parseInt(e.target.value) || 0})}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="leh-form-section" style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                      <CreditCard size={16} style={{ color: 'var(--leh-green)' }} />
                      <h4 style={{ fontSize: '13px', fontWeight: '900', color: 'var(--leh-text-dark)', margin: 0, letterSpacing: '0.05em' }}>
                        {getCategoryTemplate(formData.category) === 'TEST' ? 'PRICING & VALUATION' : 'VALUATION & LIFECYCLE'}
                      </h4>
                    </div>
                    <div className="leh-form-grid">
                      {getCategoryTemplate(formData.category) !== 'TEST' && (
                        <div className="leh-form-group">
                          <label className="leh-label">ACQUISITION COST (&#x20A6;)</label>
                          <input
                            type="number"
                            className="leh-input"
                            required
                            value={formData.cost_price}
                            onChange={e => setFormData({...formData, cost_price: parseFloat(e.target.value) || 0})}
                          />
                        </div>
                      )}
                      <div className="leh-form-group" style={{ gridColumn: getCategoryTemplate(formData.category) === 'TEST' ? '1 / -1' : 'auto' }}>
                        <label className="leh-label">RETAIL PRICE (&#x20A6;)</label>
                        <input
                          type="number"
                          className="leh-input"
                          required
                          value={formData.price}
                          onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      {getCategoryTemplate(formData.category) !== 'TEST' && (
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
                      )}
                    </div>
                  </div>
                  </fieldset>

                  {/* Footer */}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '40px', alignItems: 'center' }}>
                    {isAdmin && editingItem && (
                      deleteConfirm ? (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          background: 'rgba(220,38,38,0.06)', border: '1px solid var(--leh-red)',
                          borderRadius: '10px', padding: '8px 12px', flex: 1
                        }}>
                          <AlertTriangle size={14} style={{ color: 'var(--leh-red)', flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', color: 'var(--leh-red)', fontWeight: '700', flex: 1 }}>
                            Permanently delete this item?
                          </span>
                          <button type="button" onClick={handleDeleteItem}
                            style={{ background: 'var(--leh-red)', color: '#fff', border: 'none', borderRadius: '6px',
                              padding: '4px 12px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}>
                            YES, DELETE
                          </button>
                          <button type="button" onClick={() => setDeleteConfirm(false)}
                            style={{ background: 'transparent', border: '1px solid var(--leh-border-light)', borderRadius: '6px',
                              padding: '4px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', color: 'var(--leh-text-muted)' }}>
                            CANCEL
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setDeleteConfirm(true)}
                          className="leh-btn-outline"
                          style={{ height: '52px', padding: '0 16px', borderColor: 'var(--leh-red)',
                            color: 'var(--leh-red)', display: 'flex', alignItems: 'center', gap: '6px' }}
                          data-tooltip="Remove this asset from inventory">
                          <Trash2 size={15} />
                        </button>
                      )
                    )}
                    <button type="button" className="leh-btn-outline"
                      onClick={() => setIsModalOpen(false)}
                      style={{ height: '52px', flex: 1 }}>
                      {isAdmin ? 'CANCEL' : 'CLOSE'}
                    </button>
                    {isAdmin && (
                      <button type="submit" className="leh-btn-primary" style={{ height: '52px', flex: 2 }}>
                        {editingItem ? 'SAVE CHANGES' : 'FINALIZE REGISTRATION'}
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* ── STOCK ADJUSTMENT TAB ── */}
              {modalTab === 'stock' && editingItem && (
                <form onSubmit={handleStockAdjust}>
                  <div style={{
                    display: 'flex', gap: '16px', marginBottom: '32px',
                    background: 'var(--leh-bg-light)', borderRadius: '12px', padding: '20px'
                  }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--leh-text-muted)', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '4px' }}>ITEM</div>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--leh-text-dark)' }}>{editingItem.name}</div>
                    </div>
                    <div style={{ width: '1px', background: 'var(--leh-border-light)' }} />
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--leh-text-muted)', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '4px' }}>CURRENT STOCK</div>
                      <div style={{
                        fontSize: '28px', fontWeight: '900', lineHeight: 1,
                        color: editingItem.stock <= editingItem.reorder_level ? 'var(--leh-red)' : 'var(--leh-green)'
                      }}>{editingItem.stock}</div>
                    </div>
                    <div style={{ width: '1px', background: 'var(--leh-border-light)' }} />
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--leh-text-muted)', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '4px' }}>REORDER LEVEL</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--leh-amber)' }}>{editingItem.reorder_level}</div>
                    </div>
                  </div>

                  <div className="leh-form-group" style={{ marginBottom: '24px' }}>
                    <label className="leh-label">ADJUSTMENT TYPE</label>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                      {[
                        { val: 'IN',  label: 'Stock In',    color: 'var(--leh-green)'   },
                        { val: 'OUT', label: 'Stock Out',   color: 'var(--leh-red)'     },
                        { val: 'ADJ', label: 'Adjustment',  color: 'var(--leh-primary)' }
                      ].map(opt => (
                        <button key={opt.val} type="button"
                          onClick={() => setStockAdjust(prev => ({ ...prev, type: opt.val }))}
                          style={{
                            flex: 1, height: '52px', border: '2px solid',
                            borderColor: stockAdjust.type === opt.val ? opt.color : 'var(--leh-border-light)',
                            background: stockAdjust.type === opt.val ? `${opt.color}18` : 'transparent',
                            borderRadius: '10px', cursor: 'pointer',
                            fontSize: '12px', fontWeight: '800', letterSpacing: '0.04em',
                            color: stockAdjust.type === opt.val ? opt.color : 'var(--leh-text-muted)',
                            transition: 'all 0.15s'
                          }}>
                          {opt.label.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="leh-form-grid" style={{ marginBottom: '24px' }}>
                    <div className="leh-form-group">
                      <label className="leh-label">
                        {stockAdjust.type === 'IN' ? 'UNITS RECEIVED' : stockAdjust.type === 'OUT' ? 'UNITS DISPENSED / REMOVED' : 'CORRECTED QUANTITY'}
                      </label>
                      <input
                        type="number"
                        className="leh-input"
                        min="1"
                        required
                        placeholder="0"
                        value={stockAdjust.quantity || ''}
                        onChange={e => setStockAdjust(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                      />
                      {stockAdjust.quantity > 0 && (
                        <span style={{
                          fontSize: '11px', fontWeight: '700', marginTop: '6px', display: 'block',
                          color: stockAdjust.type === 'OUT' ? 'var(--leh-red)' : 'var(--leh-green)'
                        }}>
                          New stock will be: <strong>
                            {stockAdjust.type === 'OUT'
                              ? Math.max(0, editingItem.stock - stockAdjust.quantity)
                              : editingItem.stock + stockAdjust.quantity}
                          </strong> units
                        </span>
                      )}
                    </div>
                    <div className="leh-form-group full-width">
                      <label className="leh-label">REASON / NOTES <span style={{ color: 'var(--leh-red)' }}>*</span></label>
                      <textarea
                        className="leh-input"
                        style={{ height: '80px', resize: 'none', padding: '12px' }}
                        required
                        placeholder={
                          stockAdjust.type === 'IN'  ? 'e.g. New stock received from supplier' :
                          stockAdjust.type === 'OUT' ? 'e.g. Dispensed to patient #1042' :
                          'e.g. Physical count correction — mismatch found'
                        }
                        value={stockAdjust.reason}
                        onChange={e => setStockAdjust(prev => ({ ...prev, reason: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" className="leh-btn-outline"
                      onClick={() => setIsModalOpen(false)}
                      style={{ height: '52px', flex: 1 }}>
                      CANCEL
                    </button>
                    <button type="submit" className="leh-btn-primary"
                      style={{
                        height: '52px', flex: 2,
                        background: stockAdjust.type === 'OUT' ? 'var(--leh-red)' : undefined
                      }}>
                      APPLY ADJUSTMENT
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

      {isCategoryModalOpen && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-card" style={{ maxWidth: '900px', width: '90%' }}>
            <div className="leh-modal-header" style={{ padding: '24px 32px', borderBottom: '1px solid var(--leh-border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Box size={24} style={{ color: 'var(--leh-primary)' }} />
                <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--leh-text-dark)' }}>Manage Inventory Categories</span>
              </div>
              <button className="leh-modal-close" onClick={() => setIsCategoryModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="leh-modal-body" style={{ padding: '32px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
              {/* Category List */}
              <div style={{ borderRight: '1px solid var(--leh-border-light)', paddingRight: '24px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '900', color: 'var(--leh-text-muted)', letterSpacing: '0.05em', marginBottom: '16px', textTransform: 'uppercase' }}>Active Categories ({categories.length})</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                  {categories.map((cat) => (
                    <div 
                      key={cat.id} 
                      style={{ 
                        padding: '16px', 
                        borderRadius: '8px', 
                        border: '1px solid var(--leh-border-light)', 
                        background: 'var(--leh-bg-light)',
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontWeight: '700', color: 'var(--leh-text-dark)', fontSize: '14px' }}>{cat.name.toUpperCase()}</span>
                        <span style={{ fontSize: '12px', color: 'var(--leh-text-muted)', lineHeight: '1.4' }}>{cat.description || 'No description provided.'}</span>
                        {cat.attribute_template && cat.attribute_template !== 'NONE' && (
                          <span style={{
                            fontSize: '10px', fontWeight: '800', color: 'var(--leh-primary)',
                            background: 'rgba(var(--leh-primary-rgb, 37, 99, 235), 0.08)',
                            border: '1px solid var(--leh-primary)',
                            borderRadius: '4px', padding: '2px 6px', display: 'inline-block',
                            marginTop: '2px', letterSpacing: '0.04em'
                          }}>
                            {cat.attribute_template === 'DRUGS' ? '💊 DRUG SPECIFICS'
                              : cat.attribute_template === 'LENSES' ? '🔬 OPTICAL LENS SPECIFICS'
                              : cat.attribute_template === 'FRAMES' ? '👓 OPTICAL FRAME SPECIFICS'
                              : cat.attribute_template === 'TEST' ? '🩺 DIAGNOSTIC TEST SPECIFICS'
                              : cat.attribute_template}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button 
                          className="leh-btn-outline" 
                          style={{ height: '32px', padding: '0 8px', border: 'none', background: 'transparent' }}
                        onClick={() => {
                            setEditingCategory(cat);
                            setNewCategoryName(cat.name);
                            setNewCategoryDesc(cat.description || '');
                            setNewCategoryTemplate(cat.attribute_template || 'NONE');
                          }}
                          data-tooltip="Edit category"
                        >
                          <Edit3 size={16} style={{ color: 'var(--leh-primary)' }} />
                        </button>
                        <button 
                          className="leh-btn-outline" 
                          style={{ height: '32px', padding: '0 8px', border: 'none', background: 'transparent' }}
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          data-tooltip="Delete category"
                        >
                          <X size={16} style={{ color: 'var(--leh-red)' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add/Edit Form */}
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: '900', color: 'var(--leh-text-muted)', letterSpacing: '0.05em', marginBottom: '20px', textTransform: 'uppercase' }}>
                  {editingCategory ? 'Edit Category' : 'Create New Category'}
                </h4>
                <form onSubmit={handleAddOrUpdateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="leh-form-group">
                    <label className="leh-label">CATEGORY NAME</label>
                    <input
                      className="leh-input"
                      required
                      placeholder="e.g. Consumables, Frames"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                    />
                  </div>
                  <div className="leh-form-group">
                    <label className="leh-label">DESCRIPTION</label>
                    <textarea
                      className="leh-input"
                      style={{ height: '80px', resize: 'none', padding: '12px' }}
                      placeholder="Specify typical items or classification criteria for this category..."
                      value={newCategoryDesc}
                      onChange={e => setNewCategoryDesc(e.target.value)}
                    />
                  </div>
                  <div className="leh-form-group">
                    <label className="leh-label">SPECIFICATION TEMPLATE</label>
                    <select
                      className="leh-select"
                      value={newCategoryTemplate}
                      onChange={e => setNewCategoryTemplate(e.target.value)}
                    >
                      <option value="NONE">None / General Asset</option>
                      <option value="DRUGS">💊 Drug Specifics</option>
                      <option value="LENSES">🔬 Optical Lens Specifics</option>
                      <option value="FRAMES">👓 Optical Frame Specifics</option>
                      <option value="TEST">🩺 Diagnostic Test Specifics</option>
                    </select>
                    <span style={{ fontSize: '11px', color: 'var(--leh-text-muted)', marginTop: '6px', display: 'block' }}>
                      Controls which specification fields appear when registering items under this category.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    {editingCategory && (
                      <button 
                        type="button" 
                        className="leh-btn-outline" 
                        style={{ height: '48px', flex: 1 }}
                        onClick={() => {
                          setEditingCategory(null);
                          setNewCategoryName('');
                          setNewCategoryDesc('');
                          setNewCategoryTemplate('NONE');
                        }}
                      >
                        CANCEL
                      </button>
                    )}
                    <button 
                      type="submit" 
                      className="leh-btn-primary" 
                      style={{ height: '48px', flex: 2 }}
                    >
                      {editingCategory ? 'SAVE CHANGES' : 'CREATE CATEGORY'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
