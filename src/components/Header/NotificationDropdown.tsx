import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiBell } from 'react-icons/fi';
import { supabase } from '../../Context/supabaseClient';
import { useAuth } from '../../Context/Auth';

const NotificationDropdown = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  const { role, userLocationName, tenantId } = useAuth();
  
  const trigger = useRef<any>(null);
  const dropdown = useRef<any>(null);

  // Load initial notifications
  useEffect(() => {
    const fetchInitialNotifications = async () => {
      try {
        let query = supabase
          .from('notifications')
          .select('*')
          .eq('is_read', false)
          .eq('target_role', role)
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (userLocationName) {
           query = query.or(`target_location.eq.${userLocationName},target_location.is.null`);
        } else {
           query = query.is('target_location', null);
        }
        
        const { data, error } = await query;
        if (!error && data) {
          setNotifications(data);
          if (data.length > 0) setNotifying(true);
        }
      } catch (err) {
        console.error('Error fetching initial notifications:', err);
      }
    };
    
    if (role) {
      fetchInitialNotifications();
    }
  }, [role, userLocationName]);

  // Subscribe to real-time changes
  useEffect(() => {
    if (!role) return;

    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `target_role=eq.${role}`
        },
        (payload: any) => {
          const newNotif = payload.new;
          // Apply location filtering on client side for realtime payloads
          if (newNotif.target_location && userLocationName) {
            if (newNotif.target_location !== userLocationName) return;
          } else if (newNotif.target_location && !userLocationName) {
            return;
          }
          
          setNotifications((prev) => [newNotif, ...prev].slice(0, 10)); // Keep latest 10
          setNotifying(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, userLocationName]);

  // Handle clicking outside
  useEffect(() => {
    const clickHandler = ({ target }: MouseEvent) => {
      if (!dropdownOpen) return;
      if (
        !dropdown.current?.contains(target) &&
        !trigger.current?.contains(target)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  });

  // Handle Esc key
  useEffect(() => {
    const keyHandler = ({ keyCode }: KeyboardEvent) => {
      if (!dropdownOpen || keyCode !== 27) return;
      setDropdownOpen(false);
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  });

  const markAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (notifications.length <= 1) setNotifying(false);
    } catch (err) {
      console.error(err);
    }
    setDropdownOpen(false);
  };

  const markAllAsRead = async () => {
    try {
      const ids = notifications.map(n => n.id);
      if (ids.length === 0) return;
      await supabase.from('notifications').update({ is_read: true }).in('id', ids);
      setNotifications([]);
      setNotifying(false);
    } catch (err) {
      console.error(err);
    }
    setDropdownOpen(false);
  };

  return (
    <li className="relative">
      <Link
        ref={trigger}
        onClick={(e) => {
          e.preventDefault();
          setDropdownOpen(!dropdownOpen);
        }}
        to="#"
        className="relative flex h-8.5 w-8.5 items-center justify-center rounded-full border-[0.5px] border-stroke bg-gray hover:text-primary dark:border-strokedark dark:bg-meta-4 dark:text-white transition"
      >
        <span
          className={`absolute -top-0.5 right-0 z-1 h-2 w-2 rounded-full bg-meta-1 ${
            notifying === false ? 'hidden' : 'inline'
          }`}
        >
          <span className="absolute -z-1 inline-flex h-full w-full animate-ping rounded-full bg-meta-1 opacity-75"></span>
        </span>

        <FiBell size={18} />
      </Link>

      <div
        ref={dropdown}
        onFocus={() => setDropdownOpen(true)}
        onBlur={() => setDropdownOpen(false)}
        className={`absolute -right-27 mt-2.5 flex h-90 w-75 flex-col rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark sm:right-0 sm:w-80 ${
          dropdownOpen === true ? 'block' : 'hidden'
        }`}
      >
        <div className="px-4.5 py-3 flex justify-between items-center border-b border-stroke dark:border-strokedark">
          <h5 className="text-sm font-medium text-bodydark2">Notifications</h5>
          {notifications.length > 0 && (
             <button onClick={markAllAsRead} className="text-xs text-primary hover:underline transition">Mark all read</button>
          )}
        </div>

        <ul className="flex h-auto flex-col overflow-y-auto">
          {notifications.length === 0 ? (
            <li className="flex items-center justify-center h-20 text-xs text-gray-500">
               No new notifications
            </li>
          ) : (
            notifications.map((notif) => (
              <li key={notif.id}>
                <Link
                  className="flex flex-col gap-2.5 border-t border-stroke px-4.5 py-3 hover:bg-gray-2 dark:border-strokedark dark:hover:bg-meta-4 transition"
                  to={`${tenantId ? `/${tenantId}` : ''}${notif.link}`}
                  onClick={() => markAsRead(notif.id)}
                >
                  <p className="text-sm">
                    <span className="text-black dark:text-white font-bold block">
                      {notif.title}
                    </span>
                    <span className="text-xs text-gray-500">
                      {notif.message}
                    </span>
                  </p>
                  <p className="text-xs text-primary">Just now</p>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </li>
  );
};

export default NotificationDropdown;
