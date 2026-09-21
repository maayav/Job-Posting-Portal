import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import catalog from '../data/role-catalog.json';
import SmoothTabs from './ui/smooth-tabs';
import SkillWeightChart from './ui/skill-weight-chart';

const tabs = [{ id: 'skills', label: 'Skills to learn' }, { id: 'resources', label: 'Learning resources' }];
export default function RoleGuide() {
  const [roleId, setRoleId] = useState('AI Engineer');
  const [view, setView] = useState('skills');
  const role = catalog.roles.find((r) => r.id === roleId) ?? catalog.roles[0];
  const index = catalog.roles.indexOf(role);
  function move(delta) {
    setRoleId(catalog.roles[(index + delta + catalog.roles.length) % catalog.roles.length].id);
  }
  return <div className="role-guide">
    <div className="role-guide-toolbar">
      <label htmlFor="guide-role">Choose a role<select id="guide-role" value={role.id} onChange={(e) => setRoleId(e.target.value)}>
        {catalog.roles.map((r) => <option value={r.id} key={r.id}>{r.label}</option>)}
      </select></label>
      <SmoothTabs items={tabs} value={view} onChange={setView} label="Role guide view" panelId="role-guide-panel" />
    </div>
    <div className="role-guide-layout">
      <aside className="role-guide-summary">
        <span className="landing-label">Role guide / {String(index + 1).padStart(2, '0')}</span>
        <h3>{role.label}</h3>
        <p>{role.skills.length} skills in this guide. The same skills are used to assess your resume when you choose this role.</p>
        <p className="role-guide-explanation">Weights show how much each skill contributes to Vortex’s analysis. They are our starting criteria, not hiring requirements or your personal score.</p>
        <Link className="landing-text-link" to={'/analysis/new?role=' + encodeURIComponent(role.id)}>Check my skills for this role <span aria-hidden="true">↗</span></Link>
        <div className="role-guide-pagination">
          <button type="button" onClick={() => move(-1)} aria-label="Previous role">←</button>
          <span>{index + 1} / {catalog.roles.length}</span>
          <button type="button" onClick={() => move(1)} aria-label="Next role">→</button>
        </div>
        <small>Use the arrows, choose a role, or swipe the panel.</small>
      </aside>
      <div className="role-guide-viewport">
        <AnimatePresence initial={false} mode="wait">
          <motion.div className="role-guide-panel" key={role.id + view} id="role-guide-panel"
            role="tabpanel" aria-labelledby={'role-guide-panel-' + view} tabIndex={0}
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
            transition={{ duration: .18 }} drag="x" dragConstraints={{ left: 0, right: 0 }}
            dragElastic={.12} dragSnapToOrigin style={{ touchAction: 'pan-y' }}
            onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 65) move(info.offset.x < 0 ? 1 : -1); }}>
            {view === 'skills' ? <>
              <div className="role-guide-columns"><span>Skill</span><span>Analysis weight / 1.00</span></div>
              <SkillWeightChart skills={role.skills} />
            </> : <ul className="role-guide-resources">
              {role.skills.map((skill) => <li key={skill.name}>
                <strong>{skill.name}</strong>
                {skill.resources.length ? skill.resources.map((resource) => <a key={resource.url}
                  href={resource.url} target="_blank" rel="noreferrer"
                  onPointerDownCapture={(event) => event.stopPropagation()}>{resource.title} <span aria-hidden="true">↗</span></a>)
                  : <p>A resource for this skill has not been added yet.</p>}
              </li>)}
            </ul>}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
    <div className="role-guide-source">Source: Vortex’s built-in analysis criteria and curated resource catalog. This guide is available before you sign up.</div>
  </div>;
}
