import React, { useState } from 'react';
import { BookOpen, Scale, Headphones, ChevronDown, ChevronUp, Mail, Phone, Clock } from 'lucide-react';
import './HelpPage.css';

const HelpPage = () => {
  const [openFaq, setOpenFaq] = useState(0);

  const faqs = [
    {
      question: 'What are the Hours of Service (HOS) rules?',
      answer: 'The HOS rules govern the working hours of anyone operating a commercial motor vehicle. Key rules include the 11-hour driving limit, 14-hour on-duty window, 30-minute break requirement, and the 70-hour/8-day limit.'
    },
    {
      question: 'How do I certify my daily log?',
      answer: 'To certify your log, go to the Logs page, select the correct date, review your duty status entries for accuracy, scroll to the bottom, and click the "Certify Log" button. This legally binds your signature to the record.'
    },
    {
      question: 'What is the 34-hour restart provision?',
      answer: 'The 34-hour restart provision allows drivers to reset their 70-hour/8-day clock by taking at least 34 consecutive hours off duty or in the sleeper berth.'
    },
    {
      question: 'How does the sleeper berth split work?',
      answer: 'The sleeper berth split allows you to split your 10-hour off-duty requirement into two periods (e.g., 7 hours and 3 hours), provided one period is at least 7 consecutive hours in the sleeper berth and the other is at least 2 consecutive hours off duty.'
    },
    {
      question: 'What happens if I have a violation?',
      answer: 'If you exceed your hours, the ELD will record a violation. You must add a remark explaining the reason for the violation (e.g., adverse driving conditions) and contact your carrier immediately.'
    },
    {
      question: 'How do I edit a past log entry?',
      answer: 'You can edit past logs (except driving time) from the Records page. Select the record, click Edit, make your changes, add an annotation explaining the change, and re-certify the log. All edits are permanently tracked.'
    }
  ];

  const rules = [
    { name: '11-Hour Driving', limit: 'Max 11 hrs driving after 10 hrs off', reg: '§395.3(a)(3)(i)' },
    { name: '14-Hour Window', limit: 'Max 14 hrs on-duty window', reg: '§395.3(a)(2)' },
    { name: '30-Minute Break', limit: 'Required after 8 hrs driving', reg: '§395.3(a)(3)(ii)' },
    { name: '70-Hour/8-Day', limit: 'Max 70 hrs on-duty in 8 days', reg: '§395.3(b)(2)' }
  ];

  return (
    <div className="help-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Help Center</h1>
          <p className="page-subtitle">Resources, regulations & support</p>
        </div>
      </div>

      <div className="content-grid">
        <div className="faq-section card">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className={`faq-item ${openFaq === index ? 'open' : ''}`}
              >
                <button 
                  className="faq-question" 
                  onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                >
                  {faq.question}
                  {openFaq === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                <div className="faq-answer-wrapper">
                  <p className="faq-answer">{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="side-content">
          <div className="rules-card card">
            <h2 className="section-title">HOS Rules Quick Reference</h2>
            <table className="rules-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Limit</th>
                  <th>Regulation</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule, index) => (
                  <tr key={index}>
                    <td className="rule-name">{rule.name}</td>
                    <td className="rule-limit">{rule.limit}</td>
                    <td className="rule-reg">{rule.reg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="contact-card card">
            <h2 className="section-title">Support Contact</h2>
            <div className="contact-info">
              <div className="contact-item">
                <Phone size={18} className="contact-icon" />
                <div>
                  <div className="contact-label">Phone Support (24/7)</div>
                  <div className="contact-value">1-800-555-0199</div>
                </div>
              </div>
              <div className="contact-item">
                <Mail size={18} className="contact-icon" />
                <div>
                  <div className="contact-label">Email Support</div>
                  <div className="contact-value">support@logmapper.com</div>
                </div>
              </div>
              <div className="contact-item">
                <Clock size={18} className="contact-icon" />
                <div>
                  <div className="contact-label">Technical Support Hours</div>
                  <div className="contact-value">24 hours a day, 7 days a week</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
